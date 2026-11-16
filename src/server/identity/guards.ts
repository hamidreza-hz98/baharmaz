import "server-only";
import { cookies } from "next/headers";
import { connectDatabase } from "@/server/database/connection";
import {
  resolveSessionDetails,
  type PrincipalType,
} from "@/server/identity/identity";

const names = {
  admin: "lamsechi_admin_session",
  customer: "lamsechi_customer_session",
} as const;
export async function setSessionCookie(
  type: PrincipalType,
  token: string,
  expiresAt: Date,
) {
  (await cookies()).set(names[type], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function clearSessionCookie(type: PrincipalType) {
  (await cookies()).set(names[type], "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
export async function requirePrincipal(type: PrincipalType) {
  await connectDatabase();
  const principal = await resolveSessionDetails(
    (await cookies()).get(names[type])?.value,
    type,
  );
  if (!principal) throw new UnauthorizedError();
  return principal;
}
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
