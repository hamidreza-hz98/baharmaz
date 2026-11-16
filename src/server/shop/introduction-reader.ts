import "server-only";
import type { ShopIntroductionReader } from "@/modules/shop/introduction";
import { connectDatabase } from "@/server/database/connection";
import { readContent } from "@/server/content/settings";
export const shopIntroductionReader: ShopIntroductionReader = {
  async read() {
    await connectDatabase();
    const { content } = await readContent();
    return {
      name: "بهارمز",
      message:
        content.homepage.slogans.find((item) => item.text)?.text ||
        "فروشگاه آنلاین در حال آماده‌سازی است.",
    };
  },
};
