/** Public information only; this type is safe to use in either environment. */
export type ShopIntroduction = { name: string; message: string };

export interface ShopIntroductionReader {
  read(): Promise<ShopIntroduction>;
}

/** The domain depends on a port, not on storage or framework APIs. */
export async function getShopIntroduction(
  reader: ShopIntroductionReader,
): Promise<ShopIntroduction> {
  return reader.read();
}
