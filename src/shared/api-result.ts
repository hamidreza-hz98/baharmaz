/** Stable public error codes. Never put exception messages or secrets in a response. */
export type PublicErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: PublicErrorCode; message: string } };

export function success<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function internalError(): ApiResult<never> {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
    },
  };
}
