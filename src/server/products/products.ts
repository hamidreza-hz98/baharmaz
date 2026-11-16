import "server-only";
import { sanitizeRichDescription } from "./rich-description.ts";
import mongoose, { Schema } from "mongoose";
import { makeSlug } from "../../shared/locale.ts";
import {
  Category,
  Ingredient,
  CatalogConflict,
  CatalogNotFound,
} from "../catalog/catalog.ts";
import { withCatalogReferenceLock } from "../catalog/reference-lock.ts";
import { getMedia } from "../media/storage.ts";

const schema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    searchTitle: { type: String, required: true },
    slug: { type: String, required: true, immutable: true },
    excerpt: { type: String, maxlength: 300, default: "" },
    description: { type: String, maxlength: 10000, default: "" },
    gallery: [{ type: String }],
    categoryId: { type: String, required: true },
    ingredientIds: [{ type: String }],
    priceRials: { type: Number, required: true },
    discountPriceRials: { type: Number, default: null },
    promoted: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    revision: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, autoIndex: false, versionKey: false },
);
schema.index({ slug: 1 }, { unique: true });
schema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
schema.index({ categoryId: 1, deletedAt: 1 });
schema.index({ ingredientIds: 1, deletedAt: 1 });
export const Product =
  mongoose.models.Product || mongoose.model("Product", schema);
const idPattern = /^[a-f\d]{24}$/i;
function id(value: unknown): string {
  if (typeof value !== "string" || !idPattern.test(value))
    throw new RangeError("Invalid reference.");
  return value.toLowerCase();
}
function text(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new RangeError("Invalid text.");
  const result = value.trim().normalize("NFKC");
  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)
  )
    throw new RangeError("Invalid text.");
  return result;
}
function prices(price: unknown, discount: unknown) {
  if (
    typeof price !== "number" ||
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    price % 10 !== 0
  )
    throw new RangeError("Price must be positive whole tomans in rials.");
  if (
    discount !== null &&
    (typeof discount !== "number" ||
      !Number.isSafeInteger(discount) ||
      discount <= 0 ||
      discount >= price ||
      discount % 10 !== 0)
  )
    throw new RangeError("Invalid discounted price.");
  return { priceRials: price, discountPriceRials: discount as number | null };
}
function ids(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max)
    throw new RangeError("Invalid reference list.");
  const result = value.map(id);
  if (new Set(result).size !== result.length)
    throw new RangeError("Duplicate reference.");
  return result;
}
function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new RangeError("Invalid revision.");
  return value;
}
function isDuplicate(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
async function checkIndex() {
  const indexes = await Product.collection.indexes().catch(() => []);
  if (
    !indexes.some(
      (index) =>
        index.unique === true &&
        Object.keys(index.key).length === 1 &&
        index.key.slug === 1,
    )
  )
    throw new Error("Product slug index is missing.");
}
async function validate(input: Record<string, unknown>) {
  const title = text(input.title, 2, 120);
  const excerpt = text(input.excerpt ?? "", 0, 300);
  const description = sanitizeRichDescription(
    text(input.description ?? "", 0, 10000),
  );
  if (description.length > 10000)
    throw new RangeError("Description is too long.");
  const gallery = ids(input.gallery, 10);
  const ingredientIds = ids(input.ingredientIds, 50);
  const categoryId = id(input.categoryId);
  if (
    typeof input.available !== "boolean" ||
    typeof input.promoted !== "boolean"
  )
    throw new RangeError("Invalid product status.");
  const parsedPrices = prices(
    input.priceRials,
    input.discountPriceRials ?? null,
  );
  if (!(await Category.exists({ _id: categoryId, deletedAt: null })))
    throw new RangeError("Category is unavailable.");
  if (
    ingredientIds.length &&
    (await Ingredient.countDocuments({
      _id: { $in: ingredientIds },
      deletedAt: null,
    })) !== ingredientIds.length
  )
    throw new RangeError("Ingredient is unavailable.");
  for (const mediaId of gallery) {
    const media = await getMedia(mediaId);
    if (
      !media ||
      media.file.metadata?.kind !== "image" ||
      media.file.metadata?.contentType !== "image/webp"
    )
      throw new RangeError("Image is unavailable.");
  }
  return {
    title,
    searchTitle: title.toLocaleLowerCase("fa-IR"),
    excerpt,
    description,
    gallery,
    categoryId,
    ingredientIds,
    ...parsedPrices,
    available: input.available,
    promoted: input.promoted,
  };
}
function output(item: {
  _id: unknown;
  title: string;
  slug: string;
  excerpt: string;
  description: string;
  gallery: string[];
  categoryId: string;
  ingredientIds: string[];
  priceRials: number;
  discountPriceRials: number | null;
  promoted: boolean;
  available: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(item._id),
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    description: item.description,
    gallery: item.gallery,
    categoryId: item.categoryId,
    ingredientIds: item.ingredientIds,
    priceRials: item.priceRials,
    discountPriceRials: item.discountPriceRials,
    promoted: item.promoted,
    available: item.available,
    revision: item.revision,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    seo: {
      title: `${item.title} | بهارمز`,
      description: (
        item.excerpt || `مشاهده ${item.title} در فروشگاه بهارمز.`
      ).slice(0, 160),
    },
  };
}
export async function createProduct(input: Record<string, unknown>) {
  return withCatalogReferenceLock(async () => {
    const values = await validate(input);
    await checkIndex();
    const base = makeSlug(values.title);
    for (let n = 1; n <= 1000; n++) {
      try {
        const item = await Product.create({
          ...values,
          slug: n === 1 ? base : `${base}-${n}`,
        });
        return output(item);
      } catch (error) {
        if (!isDuplicate(error)) throw error;
      }
    }
    throw new CatalogConflict("No unique slug available.");
  });
}
export async function updateProduct(
  productId: string,
  input: Record<string, unknown>,
) {
  return withCatalogReferenceLock(async () => {
    const product = id(productId);
    const expected = revision(input.revision);
    const values = await validate(input);
    const result = await Product.findOneAndUpdate(
      { _id: product, deletedAt: null, revision: expected },
      { $set: values, $inc: { revision: 1 } },
      { new: true, runValidators: true },
    ).lean();
    if (result) return output(result);
    if (await Product.exists({ _id: product, deletedAt: null }))
      throw new CatalogConflict("Product changed.");
    throw new CatalogNotFound();
  });
}
export async function changeProductPrice(
  productId: string,
  input: Record<string, unknown>,
) {
  const product = id(productId);
  const expected = revision(input.revision);
  const values = prices(input.priceRials, input.discountPriceRials ?? null);
  const item = await Product.findOneAndUpdate(
    { _id: product, deletedAt: null, revision: expected },
    { $set: values, $inc: { revision: 1 } },
    { new: true, runValidators: true },
  ).lean();
  if (item) return output(item);
  if (await Product.exists({ _id: product, deletedAt: null }))
    throw new CatalogConflict("Product changed.");
  throw new CatalogNotFound();
}
export async function archiveProduct(
  productId: string,
  expectedRevision: unknown,
) {
  return withCatalogReferenceLock(async () => {
    const product = id(productId);
    const expected = revision(expectedRevision);
    const result = await Product.updateOne(
      { _id: product, deletedAt: null, revision: expected },
      {
        $set: { deletedAt: new Date(), available: false },
        $inc: { revision: 1 },
      },
    );
    if (result.modifiedCount) return;
    if (await Product.exists({ _id: product, deletedAt: null }))
      throw new CatalogConflict("Product changed.");
    throw new CatalogNotFound();
  });
}
export async function getProduct(productId: string) {
  const item = await Product.findOne({
    _id: id(productId),
    deletedAt: null,
  }).lean();
  if (!item) throw new CatalogNotFound();
  const [category, ingredients] = await Promise.all([
    Category.findById(item.categoryId)
      .select("name imageId iconId deletedAt")
      .lean(),
    Ingredient.find({ _id: { $in: item.ingredientIds } })
      .select("name iconId deletedAt")
      .lean(),
  ]);
  return {
    ...output(item),
    category: category
      ? {
          id: String(category._id),
          name: category.name,
          imageId: category.imageId ?? null,
          iconId: category.iconId ?? null,
          archived: Boolean(category.deletedAt),
        }
      : null,
    ingredients: ingredients.map((ingredient) => ({
      id: String(ingredient._id),
      name: ingredient.name,
      iconId: ingredient.iconId ?? null,
      archived: Boolean(ingredient.deletedAt),
    })),
  };
}
export async function listProducts(options: {
  query: string;
  availability: string;
  promotion: string;
  page: number;
  limit: number;
}) {
  const query = text(options.query, 0, 80).toLocaleLowerCase("fa-IR");
  if (
    !["all", "available", "unavailable"].includes(options.availability) ||
    !["all", "promoted", "not-promoted"].includes(options.promotion) ||
    !Number.isInteger(options.page) ||
    options.page < 1 ||
    options.page > 1000 ||
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 50
  )
    throw new RangeError("Invalid filter.");
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query)
    filter.searchTitle = {
      $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    };
  if (options.availability !== "all")
    filter.available = options.availability === "available";
  if (options.promotion !== "all")
    filter.promoted = options.promotion === "promoted";
  const [items, total, all, available, promoted] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    Product.countDocuments(filter),
    Product.countDocuments({ deletedAt: null }),
    Product.countDocuments({ deletedAt: null, available: true }),
    Product.countDocuments({ deletedAt: null, promoted: true }),
  ]);
  const categories = await Category.find({
    _id: { $in: items.map((item) => item.categoryId) },
  })
    .select("name deletedAt")
    .lean();
  const names = new Map(
    categories.map((category) => [
      String(category._id),
      { name: category.name as string, archived: Boolean(category.deletedAt) },
    ]),
  );
  return {
    items: items.map((item) => ({
      ...output(item),
      category: names.get(item.categoryId) ?? null,
    })),
    total,
    page: options.page,
    limit: options.limit,
    counts: { all, available, unavailable: all - available, promoted },
  };
}
