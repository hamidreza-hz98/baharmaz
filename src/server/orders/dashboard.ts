import "server-only";
import { Order } from "@/server/orders/orders";
import { dashboardRange } from "@/shared/dashboard-period";

export const dashboardStatuses = [
  "all",
  "preparing",
  "delivered",
  "cancelled",
] as const;
function checked(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value % 10 !== 0)
    throw new Error("Invalid paid amount");
  return value;
}
export async function dashboardOrders(
  status: string,
  page: number,
  limit = 10,
) {
  if (
    !dashboardStatuses.includes(status as (typeof dashboardStatuses)[number]) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    ![10, 20].includes(limit)
  )
    throw new RangeError("Invalid pagination");
  const filter =
    status === "all"
      ? { isTest: { $ne: true } }
      : { status, isTest: { $ne: true } };
  const [rows, total] = await Promise.all([
    Order.find(filter)
      .select("code status placedAt customer.name totals.totalRials")
      .sort({ placedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => {
      if (
        typeof row.code !== "string" ||
        !(row.placedAt instanceof Date) ||
        Number.isNaN(row.placedAt.getTime()) ||
        !dashboardStatuses
          .slice(1)
          .includes(row.status as (typeof dashboardStatuses)[1])
      )
        throw new Error("Invalid order snapshot");
      return {
        code: row.code,
        status: row.status,
        placedAt: row.placedAt,
        customerName:
          typeof row.customer?.name === "string" ? row.customer.name : "",
        totalRials: checked(row.totals?.totalRials),
      };
    }),
    total,
    page,
    limit,
  };
}
export async function dashboardMetrics(period: string, now = Date.now()) {
  const range = dashboardRange(period, now);
  // A verified marker with missing/invalid amount or time makes the report unavailable, not zero.
  const [invalid, invalidItems, chart, customers, products] = await Promise.all(
    [
      Order.aggregate([
        { $match: { "payment.status": "verified" } },
        {
          $set: {
            verifiedDate: {
              $convert: {
                input: "$payment.verifiedAt",
                to: "date",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ["$verifiedDate", null] },
                {
                  $not: [
                    {
                      $in: [
                        { $type: "$payment.verifiedAt" },
                        ["date", "string"],
                      ],
                    },
                  ],
                },
                { $not: [{ $isNumber: "$totals.paidRials" }] },
                { $lt: ["$totals.paidRials", 0] },
                { $gt: ["$totals.paidRials", Number.MAX_SAFE_INTEGER] },
                {
                  $ne: [
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
            },
          },
        },
        { $limit: 1 },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "verified" } },
        { $unwind: "$items" },
        {
          $match: {
            $expr: {
              $or: [
                { $ne: [{ $type: "$items.title" }, "string"] },
                { $not: [{ $isNumber: "$items.quantity" }] },
                { $lt: ["$items.quantity", 1] },
                { $gt: ["$items.quantity", Number.MAX_SAFE_INTEGER] },
                {
                  $ne: [
                    {
                      $mod: [
                        {
                          $cond: [
                            { $isNumber: "$items.quantity" },
                            "$items.quantity",
                            0.5,
                          ],
                        },
                        1,
                      ],
                    },
                    0,
                  ],
                },
              ],
            },
          },
        },
        { $limit: 1 },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "verified" } },
        {
          $set: {
            verifiedDate: {
              $convert: {
                input: "$payment.verifiedAt",
                to: "date",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { verifiedDate: { $gte: range.start, $lt: range.end } } },
        {
          $group: {
            _id: {
              $dateToString: {
                date: "$verifiedDate",
                format: range.format,
                timezone: "Asia/Tehran",
              },
            },
            amount: { $sum: "$totals.paidRials" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "verified" } },
        { $sort: { placedAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$customerId",
            name: { $first: "$customer.name" },
            amount: { $sum: "$totals.paidRials" },
          },
        },
        { $sort: { amount: -1, _id: 1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { "payment.status": "verified" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.title",
            quantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { quantity: -1, _id: 1 } },
        { $limit: 5 },
      ]),
    ],
  );
  if (invalid.length || invalidItems.length)
    throw new Error("Invalid verified payment snapshot");
  return {
    chart: chart.map((row) => ({
      label: row._id,
      amount: checked(row.amount),
      count: row.count,
    })),
    customers: customers.map((row) => ({
      id: row._id,
      name: typeof row.name === "string" ? row.name : "",
      amount: checked(row.amount),
    })),
    products: products.map((row) => {
      if (
        typeof row._id !== "string" ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1
      )
        throw new Error("Invalid item snapshot");
      return { name: row._id, quantity: row.quantity };
    }),
  };
}
