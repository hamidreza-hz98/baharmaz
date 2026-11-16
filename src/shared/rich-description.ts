export const RICH_DESCRIPTION_PREFIX = "rich:v1:";
export function isRichDescription(value: string) {
  return value.startsWith(RICH_DESCRIPTION_PREFIX);
}
