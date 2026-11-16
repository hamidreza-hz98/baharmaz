import "server-only";

export interface SmsProvider {
  sendCode(mobile: string, code: string): Promise<void>;
}
/** Explicit development fake: no SMS leaves the process. Never available in production. */
export function createDevelopmentSmsProvider(
  env: NodeJS.ProcessEnv,
  deliver: (mobile: string, code: string) => void,
): SmsProvider {
  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test")
    throw new Error("Development SMS provider is disabled in production.");
  return {
    async sendCode(mobile, code) {
      deliver(mobile, code);
    },
  };
}
export function otpConfig(env: NodeJS.ProcessEnv) {
  const secret = env.OTP_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("OTP_SECRET must contain at least 32 bytes.");
  function integer(key: string, fallback: number, min: number, max: number) {
    const value = env[key];
    if (value === undefined || value === "") return fallback;
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
      throw new Error(`Invalid ${key}.`);
    return Number(value);
  }
  return {
    secret,
    expirySeconds: integer("OTP_EXPIRY_SECONDS", 120, 30, 600),
    cooldownSeconds: integer("OTP_COOLDOWN_SECONDS", 60, 15, 600),
    maxAttempts: integer("OTP_MAX_ATTEMPTS", 5, 1, 10),
    maxSendsPerHour: integer("OTP_MAX_SENDS_PER_HOUR", 5, 1, 20),
  };
}
