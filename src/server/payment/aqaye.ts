import "server-only";
import { rialsToTomans } from "../../shared/locale.ts";
export type PaymentMode = "sandbox" | "live";
export type PaymentConfig = {
  mode: PaymentMode;
  pin: string;
  callback: string;
};
export type Verification = "verified" | "already_verified" | "unconfirmed";
const origin = "https://panel.aqayepardakht.ir";
export function parsePaymentConfig(
  env: Record<string, string | undefined> = process.env,
): PaymentConfig {
  const mode = env.AQAYE_MODE;
  if (mode !== "sandbox" && mode !== "live")
    throw new Error("Payment mode is not configured.");
  if (mode === "live")
    throw new Error(
      "Live payments are disabled until order integration is complete.",
    );
  const pin = env.AQAYE_PIN?.trim();
  if (pin !== "sandbox")
    throw new Error("Sandbox pin must be explicitly configured.");
  const callback = env.AQAYE_CALLBACK_URL?.trim();
  if (!callback) throw new Error("Payment callback is required.");
  const url = new URL(callback);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error("Invalid payment callback.");
  return { mode, pin, callback: url.toString() };
}
export function providerAmount(rials: number) {
  const amount = rialsToTomans(rials);
  if (amount < 1000 || amount > 400000000)
    throw new RangeError("Amount outside provider limits.");
  return amount;
}
function transactionId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new RangeError("Invalid provider reference.");
  return value;
}
async function post(fetcher: typeof fetch, path: string, body: object) {
  const response = await fetcher(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const len = Number(response.headers.get("content-length") || 0);
  if (len > 16384) throw new Error("Invalid provider response.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Invalid provider response.");
  let size = 0,
    content = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new Error("Invalid provider response.");
    }
    content += decoder.decode(value, { stream: true });
  }
  content += decoder.decode();
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("Invalid provider response.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid provider response.");
  return { ok: response.ok, data: data as Record<string, unknown> };
}
export function createAqayeAdapter(
  config: PaymentConfig,
  fetcher: typeof fetch = fetch,
) {
  parsePaymentConfig({
    AQAYE_MODE: config.mode,
    AQAYE_PIN: config.pin,
    AQAYE_CALLBACK_URL: config.callback,
  });
  if (config.mode !== "sandbox" || config.pin !== "sandbox")
    throw new Error("Only sandbox contract testing is enabled.");
  return {
    async create(input: { amountRials: number; invoiceId: string }) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.invoiceId))
        throw new RangeError("Invalid invoice.");
      const amount = providerAmount(input.amountRials);
      const { ok, data } = await post(fetcher, "/api/v2/create", {
        pin: config.pin,
        amount,
        callback: config.callback,
        callback_method: "POST",
        invoice_id: input.invoiceId,
      });
      if (!ok || data.status !== "success")
        throw new Error("Provider initiation failed.");
      const transid = transactionId(data.transid);
      return {
        transid,
        redirectUrl: `${origin}/startpay/sandbox/${encodeURIComponent(transid)}`,
        amountTomans: amount,
      };
    },
    async verify(input: {
      amountRials: number;
      transid: string;
    }): Promise<Verification> {
      const amount = providerAmount(input.amountRials);
      const transid = transactionId(input.transid);
      const { ok, data } = await post(fetcher, "/api/v2/verify", {
        pin: config.pin,
        amount,
        transid,
      });
      if (ok && data.status === "success" && String(data.code) === "1")
        return "verified";
      if (String(data.code) === "2") return "already_verified";
      return "unconfirmed";
    },
  };
}
