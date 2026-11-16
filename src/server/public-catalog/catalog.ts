import "server-only";
import mongoose from "mongoose";
import { connectDatabase } from "@/server/database/connection";
import { Category, Ingredient, CategoryOrder } from "@/server/catalog/catalog";
import { Product } from "@/server/products/products";
import type { PublicCard } from "@/shared/public-catalog";

export type Sort = "newest" | "cheapest" | "expensive";
function card(item: {
  _id: unknown;
  slug: string;
  title: string;
  gallery: string[];
  priceRials: number;
  discountPriceRials: number | null;
  available: boolean;
  promoted: boolean;
}): PublicCard {
  return {
    id: String(item._id),
    slug: item.slug,
    title: item.title,
    image: item.gallery[0] ?? null,
    priceRials: item.priceRials,
    discountPriceRials: item.discountPriceRials,
    available: item.available,
    promoted: item.promoted,
  };
}
export async function homeCatalog() {
  await connectDatabase();
  const [categories, order, products] = await Promise.all([
    Category.find({ deletedAt: null, parentId: null })
      .select("name slug imageId")
      .sort({ createdAt: 1, _id: 1 })
      .limit(5000)
      .lean(),
    CategoryOrder.findById("homepage").lean(),
    Product.find({ deletedAt: null, promoted: true })
      .sort({ createdAt: -1, _id: -1 })
      .limit(12)
      .lean(),
  ]);
  const byId = new Map(categories.map((item) => [String(item._id), item]));
  const sorted = [];
  for (const id of order?.ids ?? []) {
    const item = byId.get(String(id));
    if (item) {
      sorted.push(item);
      byId.delete(String(id));
    }
  }
  sorted.push(...byId.values());
  return {
    categories: sorted.map((item) => ({
      id: String(item._id),
      name: item.name as string,
      slug: item.slug as string,
      imageId: item.imageId as string | null,
    })),
    products: products.map(card),
  };
}
export async function categories() {
  await connectDatabase();
  const list = await Category.find({ deletedAt: null })
    .select("name slug parentId")
    .sort({ name: 1, _id: 1 })
    .limit(5000)
    .lean();
  return list.map((x) => ({
    id: String(x._id),
    name: x.name as string,
    slug: x.slug as string,
    parentId: (x.parentId as string | null) ?? null,
  }));
}
export async function categoryBySlug(slug: string) {
  await connectDatabase();
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (slug.length > 100) return null;
  const c = await Category.findOne({ slug, deletedAt: null })
    .select("name slug excerpt parentId")
    .lean();
  return c
    ? {
        id: String(c._id),
        name: c.name as string,
        slug: c.slug as string,
        excerpt: c.excerpt as string,
        parentId: (c.parentId as string | null) ?? null,
      }
    : null;
}
export async function productBySlug(slug: string) {
  await connectDatabase();
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (slug.length > 100) return null;
  const p = await Product.findOne({ slug, deletedAt: null }).lean();
  if (!p) return null;
  const [category, ingredients] = await Promise.all([
    Category.findOne({ _id: p.categoryId, deletedAt: null })
      .select("name slug")
      .lean(),
    Ingredient.find({ _id: { $in: p.ingredientIds }, deletedAt: null })
      .select("name")
      .lean(),
  ]);
  if (!category) return null;
  return {
    ...card(p),
    excerpt: p.excerpt as string,
    description: p.description as string,
    gallery: p.gallery as string[],
    category: { name: category.name as string, slug: category.slug as string },
    ingredients: ingredients.map((i) => i.name as string),
  };
}
export async function listPublicProducts(input: {
  category?: string;
  sort: string;
  cursor?: string;
}) {
  await connectDatabase();
  if (!["newest", "cheapest", "expensive"].includes(input.sort))
    throw new RangeError("Invalid sort");
  if (input.category && !/^[a-f\d]{24}$/i.test(input.category))
    throw new RangeError("Invalid category");
  const filter: Record<string, unknown> = { deletedAt: null };
  if (input.category) {
    const children = await Category.find({
      parentId: input.category,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    filter.categoryId = {
      $in: [input.category, ...children.map((child) => String(child._id))],
    };
  }
  // A cursor is a typed ordering tuple, never a raw database query.
  let after: { id: mongoose.Types.ObjectId; value: number | Date } | null =
    null;
  if (input.cursor) {
    if (input.cursor.length > 400) throw new RangeError("Invalid cursor");
    try {
      const c = JSON.parse(
        Buffer.from(input.cursor, "base64url").toString("utf8"),
      );
      if (
        c.sort !== input.sort ||
        c.category !== (input.category ?? "") ||
        !/^[a-f\d]{24}$/i.test(c.id) ||
        !Number.isSafeInteger(c.value) ||
        c.value < 0
      )
        throw new Error();
      after = {
        id: new mongoose.Types.ObjectId(c.id),
        value: input.sort === "newest" ? new Date(c.value) : c.value,
      };
      if (after.value instanceof Date && Number.isNaN(after.value.getTime()))
        throw new Error();
    } catch {
      throw new RangeError("Invalid cursor");
    }
  }
  const direction = input.sort === "cheapest" ? 1 : -1;
  const key = input.sort === "newest" ? "createdAt" : "sellingPrice";
  const comparison = direction === 1 ? "$gt" : "$lt";
  const steps: mongoose.PipelineStage[] = [
    { $match: filter },
    {
      $addFields: {
        sellingPrice: { $ifNull: ["$discountPriceRials", "$priceRials"] },
      },
    },
  ];
  if (after)
    steps.push({
      $match: {
        $or: [
          { [key]: { [comparison]: after.value } },
          { [key]: after.value, _id: { [comparison]: after.id } },
        ],
      },
    });
  steps.push({ $sort: { [key]: direction, _id: direction } }, { $limit: 13 });
  const [rows, total] = await Promise.all([
    Product.aggregate(steps),
    Product.countDocuments(filter),
  ]);
  const hasMore = rows.length > 12;
  const items = rows.slice(0, 12);
  const last = items.at(-1);
  const nextCursor =
    hasMore && last
      ? Buffer.from(
          JSON.stringify({
            sort: input.sort,
            category: input.category ?? "",
            id: String(last._id),
            value:
              input.sort === "newest"
                ? new Date(last.createdAt).getTime()
                : last.sellingPrice,
          }),
        ).toString("base64url")
      : null;
  return { items: items.map(card), total, nextCursor };
}
