/** Pure transition contract; callers must first authenticate and correlate evidence server-side. */
export type PaymentState = "pending" | "verified" | "failed";
export type PaymentEvidence =
  | { type: "callback" }
  | {
      type: "verification";
      result: "verified" | "already_verified" | "unconfirmed";
    }
  | { type: "confirmed_failure" };
export function paymentTransition(
  current: PaymentState,
  evidence: PaymentEvidence,
): PaymentState {
  if (current === "verified") return "verified";
  if (evidence.type === "callback") return current;
  if (evidence.type === "verification")
    return evidence.result === "verified" ? "verified" : current;
  return current === "pending" ? "failed" : current;
}
