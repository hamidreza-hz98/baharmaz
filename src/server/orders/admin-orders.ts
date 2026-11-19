import "server-only";
import { Order, orderSnapshot } from "@/server/orders/orders";
import { normalizeDigits } from "@/shared/locale";
export class AdminOrderConflict extends Error {}
export class AdminOrderNotFound extends Error {}
const statuses = ["preparing", "delivered", "cancelled"] as const;
function codeValue(code: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) throw new RangeError("Invalid code");
  return code;
}
function revisionValue(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  )
    throw new RangeError("Invalid revision");
  return value;
}
export async function listAdminOrders(
  status: string,
  query: string,
  page: number,
) {
  if (
    !["all", ...statuses].includes(status) ||
    query.length > 120 ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000
  )
    throw new RangeError("Invalid filter");
  const filter: Record<string, unknown> = {};
  if (status !== "all") filter.status = status;
  const term = normalizeDigits(query.trim()).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  if (term)
    filter.$or = [
      { code: { $regex: term, $options: "i" } },
      { "customer.name": { $regex: term, $options: "i" } },
      { "customer.mobile": { $regex: term } },
    ];
  const [rows, total] = await Promise.all([
    Order.find(filter)
      .sort({ placedAt: -1, _id: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => {
      const snapshot = orderSnapshot(row);
      return {
        code: snapshot.code,
        isTest: snapshot.isTest,
        status: snapshot.status,
        placedAt: snapshot.placedAt,
        customerName: snapshot.customer.name,
        mobile: snapshot.customer.mobile,
        totalRials: snapshot.totals.totalRials,
      };
    }),
    total,
    page,
    limit: 20,
  };
}
export async function getAdminOrder(code: string) {
  const row = await Order.findOne({ code: codeValue(code) }).lean();
  if (!row) throw new AdminOrderNotFound();
  const snapshot = orderSnapshot(row);
  const revision = revisionValue(row.adminRevision ?? 0);
  const note = row.adminNote ?? "";
  if (
    typeof note !== "string" ||
    note.length > 1000 ||
    !Array.isArray(row.adminChanges ?? [])
  )
    throw new Error("Invalid admin order data");
  const history = (row.adminChanges ?? []).map(
    (entry: Record<string, unknown>) => {
      if (
        !entry ||
        !(entry.at instanceof Date) ||
        Number.isNaN(entry.at.getTime()) ||
        entry.actor !== "primary" ||
        !statuses.includes(entry.previousStatus as (typeof statuses)[number]) ||
        !statuses.includes(entry.status as (typeof statuses)[number]) ||
        typeof entry.previousNote !== "string" ||
        entry.previousNote.length > 1000 ||
        typeof entry.note !== "string" ||
        entry.note.length > 1000
      )
        throw new Error("Invalid order audit entry");
      return {
        at: entry.at,
        actor: entry.actor,
        previousStatus: entry.previousStatus,
        status: entry.status,
        previousNote: entry.previousNote,
        note: entry.note,
      };
    },
  );
  return { ...snapshot, adminRevision: revision, adminNote: note, history };
}
export async function updateAdminOrder(
  code: string,
  revision: number,
  status: string,
  note: string,
  actor: string,
) {
  codeValue(code);
  revisionValue(revision);
  if (
    !statuses.includes(status as (typeof statuses)[number]) ||
    typeof note !== "string" ||
    note.length > 1000 ||
    actor !== "primary"
  )
    throw new RangeError("Invalid change");
  const current = await getAdminOrder(code);
  if (current.adminRevision !== revision) throw new AdminOrderConflict();
  if (current.status !== status && current.status !== "preparing")
    throw new RangeError("Terminal status");
  const normalizedNote = note.trim();
  if (current.status === status && current.adminNote === normalizedNote)
    throw new RangeError("No change");
  const revisionFilter =
    revision === 0
      ? { $or: [{ adminRevision: 0 }, { adminRevision: { $exists: false } }] }
      : { adminRevision: revision };
  const result = await Order.updateOne(
    {
      code,
      status: current.status,
      ...revisionFilter,
      "adminChanges.999": { $exists: false },
    },
    {
      $set: { status, adminNote: normalizedNote },
      $inc: { adminRevision: 1 },
      $push: {
        adminChanges: {
          at: new Date(),
          actor,
          previousStatus: current.status,
          status,
          previousNote: current.adminNote,
          note: normalizedNote,
        },
      },
    },
    { runValidators: true },
  );
  if (!result.matchedCount) throw new AdminOrderConflict();
  return getAdminOrder(code);
}
