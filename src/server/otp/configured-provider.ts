import "server-only";
import { createDevelopmentSmsProvider, type SmsProvider } from "./provider.ts";
export function configuredSmsProvider(
  env: NodeJS.ProcessEnv = process.env,
): SmsProvider {
  if (
    env.NODE_ENV === "development" &&
    env.SMS_PROVIDER === "development" &&
    env.OTP_DEV_LOG_CODES === "true"
  ) {
    return createDevelopmentSmsProvider(env, (mobile, code) => {
      console.info(`[development SMS] ${mobile}: ${code}`);
    });
  }
  throw new Error("No SMS provider configured.");
}
