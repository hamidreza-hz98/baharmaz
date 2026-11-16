import "server-only";
export function validMutationOrigin(request: Request): boolean {
  try {
    return (
      Boolean(process.env.APP_ORIGIN) &&
      request.headers.get("origin") ===
        new URL(process.env.APP_ORIGIN!).origin &&
      /^application\/json(?:;|$)/i.test(
        request.headers.get("content-type") ?? "",
      )
    );
  } catch {
    return false;
  }
}
export async function readJsonObject(
  request: Request,
  limit = 4096,
): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new RangeError("Missing body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new RangeError("Body too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  const data: unknown = JSON.parse(text + decoder.decode());
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new RangeError("Invalid body.");
  return data as Record<string, unknown>;
}
