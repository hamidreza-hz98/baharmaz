import "server-only";
import mongoose from "mongoose";
import { Customer } from "@/server/identity/identity";
import { Order } from "@/server/orders/orders";
import { normalizeDigits, normalizeIranianMobile } from "@/shared/locale";

export class CustomerConflict extends Error {}
function nameValue(input: string) {
  const name = input.trim();
  if (name.length < 2 || name.length > 120)
    throw new RangeError("Invalid name");
  return name;
}
async function requireMobileIndex() {
  const indexes = await Customer.collection.indexes();
  if (
    !indexes.some(
      (index) =>
        index.unique === true &&
        !index.sparse &&
        !index.partialFilterExpression &&
        Object.keys(index.key).length === 1 &&
        index.key.mobile === 1,
    )
  )
    throw new Error("Unique mobile index required");
}
const duplicate = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;
export async function createAdminCustomer(name: string, mobile: string) {
  await requireMobileIndex();
  try {
    const customer = await Customer.create({
      name: nameValue(name),
      mobile: normalizeIranianMobile(mobile),
      mobileVerified: false,
      authVersion: 0,
    });
    return { id: String(customer._id) };
  } catch (error) {
    if (duplicate(error)) throw new CustomerConflict();
    throw error;
  }
}
export async function updateAdminCustomer(
  id: string,
  name: string,
  rawMobile: string,
  expectedMobile: string,
) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new RangeError("Invalid ID");
  const mobile = normalizeIranianMobile(rawMobile),
    expected = normalizeIranianMobile(expectedMobile);
  await requireMobileIndex();
  try {
    const update =
      mobile === expected
        ? { $set: { name: nameValue(name) } }
        : {
            $set: { name: nameValue(name), mobile, mobileVerified: false },
            $inc: { authVersion: 1 },
            $unset: { phoneChange: "" },
          };
    const result = await Customer.updateOne(
      { _id: id, mobile: expected },
      update,
      { runValidators: true },
    );
    if (!result.matchedCount) throw new CustomerConflict();
    return { ok: true };
  } catch (error) {
    if (duplicate(error)) throw new CustomerConflict();
    throw error;
  }
}
function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value % 10)
    throw new Error("Invalid purchase total");
  return value;
}
const paidValid = {
  $and: [
    { $eq: ["$payment.status", "verified"] },
    { $in: [{ $type: "$payment.verifiedAt" }, ["date", "string"]] },
    {
      $ne: [
        {
          $convert: {
            input: "$payment.verifiedAt",
            to: "date",
            onError: null,
            onNull: null,
          },
        },
        null,
      ],
    },
    { $isNumber: "$totals.paidRials" },
    { $gte: ["$totals.paidRials", 0] },
    { $lte: ["$totals.paidRials", Number.MAX_SAFE_INTEGER] },
    {
      $eq: [
        {
          $mod: [
            {
              $cond: [
                { $isNumber: "$totals.paidRials" },
                "$totals.paidRials",
                1,
              ],
            },
            10,
          ],
        },
        0,
      ],
    },
  ],
};
function groupMetrics(id: unknown) {
  return {
    _id: id,
    count: { $sum: 1 },
    paid: { $sum: { $cond: [paidValid, "$totals.paidRials", 0] } },
    invalid: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ["$payment.status", "verified"] },
              { $not: [paidValid] },
            ],
          },
          1,
          0,
        ],
      },
    },
  };
}
export async function listAdminCustomers(
  query: string,
  verification: string,
  page: number,
  limit: number,
) {
  if (
    query.length > 120 ||
    !["all", "verified", "unverified"].includes(verification) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    ![5, 10, 20].includes(limit)
  )
    throw new RangeError("Invalid filter");
  const text = normalizeDigits(query.trim());
  const filter: Record<string, unknown> = {};
  if (text) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { mobile: { $regex: escaped } },
    ];
  }
  if (verification !== "all")
    filter.mobileVerified = verification === "verified" ? true : { $ne: true };
  const [total, count, unverified, customers, overall] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.countDocuments(),
    Customer.countDocuments({ mobileVerified: { $ne: true } }),
    Customer.find(filter)
      .select("name mobile mobileVerified createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.aggregate([
      { $group: groupMetrics("$customerId") },
      {
        $set: {
          ownerId: {
            $convert: {
              input: "$_id",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: Customer.collection.name,
          localField: "ownerId",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $match: { "owner.0": { $exists: true } } },
      {
        $group: {
          _id: null,
          paid: { $sum: "$paid" },
          invalid: { $sum: "$invalid" },
        },
      },
    ] as mongoose.PipelineStage[]),
  ]);
  const ids = customers.map((c) => String(c._id));
  const aggregates = ids.length
    ? await Order.aggregate([
        { $match: { customerId: { $in: ids } } },
        { $group: groupMetrics("$customerId") },
      ] as mongoose.PipelineStage[])
    : [];
  if (overall[0]?.invalid || aggregates.some((x) => x.invalid))
    throw new Error("Invalid verified payment data");
  const byId = new Map(aggregates.map((x) => [x._id, x]));
  return {
    total,
    page,
    limit,
    summary: {
      customers: count,
      unverified,
      purchaseRials: money(overall[0]?.paid ?? 0),
    },
    items: customers.map((c) => {
      const id = String(c._id),
        totals = byId.get(id);
      return {
        id,
        name: c.name,
        mobile: c.mobile,
        mobileVerified: c.mobileVerified === true,
        createdAt: c.createdAt,
        orderCount: totals?.count ?? 0,
        purchaseRials: money(totals?.paid ?? 0),
      };
    }),
  };
}
