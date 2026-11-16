import "server-only";
export function publicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.APP_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    if (env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function absolutePublicUrl(path: string): string | undefined {
  const origin = publicOrigin();
  if (
    !origin ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  )
    return undefined;
  return new URL(path, `${origin}/`).toString();
}
