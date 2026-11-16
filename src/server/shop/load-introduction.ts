import "server-only";
import { getShopIntroduction } from "@/modules/shop/introduction";
import { shopIntroductionReader } from "@/server/shop/introduction-reader";

export function loadShopIntroduction() {
  return getShopIntroduction(shopIntroductionReader);
}
