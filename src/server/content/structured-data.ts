import "server-only";
export function safeJsonLd(value: object): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
