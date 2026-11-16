import "server-only";
import mongoose, { Schema } from "mongoose";
import { makeSlug } from "../../shared/locale.ts";
import { getMedia } from "../media/storage.ts";
import { withCatalogReferenceLock } from "./reference-lock.ts";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    excerpt: { type: String, maxlength: 300, default: "" },
    slug: { type: String, required: true, immutable: true },
    imageId: { type: String, default: null },
    iconId: { type: String, default: null },
    parentId: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, autoIndex: false },
);
categorySchema.index({ slug: 1 }, { unique: true });
const ingredientSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    normalizedName: { type: String, required: true },
    iconId: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, autoIndex: false },
);
ingredientSchema.index({ normalizedName: 1 }, { unique: true });
const orderSchema = new Schema(
  {
    _id: { type: String, default: "homepage" },
    ids: [{ type: Schema.Types.ObjectId }],
    revision: { type: Number, default: 0 },
  },
  { versionKey: false, autoIndex: false },
);
export const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
export const Ingredient =
  mongoose.models.Ingredient || mongoose.model("Ingredient", ingredientSchema);
export const CategoryOrder =
  mongoose.models.CategoryOrder || mongoose.model("CategoryOrder", orderSchema);
export class CatalogConflict extends Error {}
export class CatalogReferenced extends CatalogConflict {}
export class CatalogNotFound extends Error {}
export class CatalogIndexMissing extends Error {}
function requiredName(value: unknown, max: number): string {
  if (typeof value !== "string") throw new RangeError("Invalid name.");
  const name = value.trim().normalize("NFKC");
  if (
    name.length < 2 ||
    name.length > max ||
    /[\u0000-\u001f\u007f]/.test(name)
  )
    throw new RangeError("Invalid name.");
  return name;
}
function idValue(id: unknown): string {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))
    throw new RangeError("Invalid identifier.");
  return id.toLowerCase();
}
function duplicate(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
async function ensureUniqueIndex(
  model: typeof Category | typeof Ingredient,
  field: string,
) {
  const indexes = await model.collection.indexes().catch(() => []);
  if (
    !indexes.some(
      (index) =>
        index.unique === true &&
        Object.keys(index.key).length === 1 &&
        index.key[field] === 1,
    )
  )
    throw new CatalogIndexMissing("Required catalog unique index is missing.");
}
async function imageId(
  value: unknown,
  required = false,
): Promise<string | null> {
  if (value === null || value === undefined || value === "") {
    if (required) throw new RangeError("Image required.");
    return null;
  }
  const id = idValue(value);
  const media = await getMedia(id);
  if (
    !media ||
    media.file.metadata?.kind !== "image" ||
    media.file.metadata?.contentType !== "image/webp"
  )
    throw new RangeError("Image not found.");
  return id;
}
function excerptValue(value: unknown): string {
  if (typeof value !== "string") throw new RangeError("Invalid description.");
  const text = value.trim();
  if (
    text.length > 300 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
  )
    throw new RangeError("Invalid description.");
  return text;
}
function categoryOutput(item: {
  _id: unknown;
  name: string;
  slug: string;
  excerpt: string;
  imageId?: string | null;
  iconId?: string | null;
  parentId?: string | null;
}) {
  return {
    id: String(item._id),
    name: item.name,
    slug: item.slug,
    excerpt: item.excerpt,
    imageId: item.imageId ?? null,
    iconId: item.iconId ?? null,
    parentId: item.parentId ?? null,
    seo: {
      title: `${item.name} | بهارمز`,
      description: (
        item.excerpt || `محصولات دسته‌بندی ${item.name} در فروشگاه بهارمز.`
      ).slice(0, 160),
    },
  };
}
function ingredientOutput(item: {
  _id: unknown;
  name: string;
  iconId: string;
}) {
  return { id: String(item._id), name: item.name, iconId: item.iconId };
}
async function validateParent(
  value: unknown,
  currentId?: string,
): Promise<string | null> {
  if (value === undefined || value === null || value === "") return null;
  const parentId = idValue(value);
  if (parentId === currentId)
    throw new RangeError("A category cannot be its own parent.");
  const parent = await Category.findOne({
    _id: parentId,
    deletedAt: null,
  }).lean();
  if (!parent || parent.parentId)
    throw new RangeError("Parent must be an active top-level category.");
  if (
    currentId &&
    (await Category.exists({ parentId: currentId, deletedAt: null }))
  )
    throw new RangeError(
      "A category with children cannot become a subcategory.",
    );
  return parentId;
}
export async function createCategory(input: Record<string, unknown>) {
  return withCatalogReferenceLock(async () => {
    const name = requiredName(input.name, 120);
    const excerpt = excerptValue(input.excerpt ?? "");
    const image = await imageId(input.imageId);
    const icon = await imageId(input.iconId);
    const parentId = await validateParent(input.parentId);
    const base = makeSlug(name);
    await ensureUniqueIndex(Category, "slug");
    for (let n = 1; n <= 1000; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      try {
        const item = await Category.create({
          name,
          excerpt,
          imageId: image,
          iconId: icon,
          parentId,
          slug,
        });
        return categoryOutput(item);
      } catch (error) {
        if (!duplicate(error)) throw error;
      }
    }
    throw new CatalogConflict("Cannot allocate a unique slug.");
  });
}
export async function updateCategory(
  id: string,
  input: Record<string, unknown>,
) {
  return withCatalogReferenceLock(async () => {
    const name = requiredName(input.name, 120);
    const excerpt = excerptValue(input.excerpt ?? "");
    const image = await imageId(input.imageId);
    const icon = await imageId(input.iconId);
    const currentId = idValue(id);
    const existing = await Category.findOne({
      _id: currentId,
      deletedAt: null,
    }).lean();
    if (!existing) throw new CatalogNotFound();
    const parentId = await validateParent(
      input.parentId === undefined ? existing.parentId : input.parentId,
      currentId,
    );
    const item = await Category.findOneAndUpdate(
      { _id: currentId, deletedAt: null },
      { $set: { name, excerpt, imageId: image, iconId: icon, parentId } },
      { new: true, runValidators: true },
    ).lean();
    if (!item) throw new CatalogNotFound();
    return categoryOutput(item);
  });
}
export async function createIngredient(input: Record<string, unknown>) {
  return withCatalogReferenceLock(async () => {
    const name = requiredName(input.name, 80);
    const icon = await imageId(input.iconId, true);
    await ensureUniqueIndex(Ingredient, "normalizedName");
    try {
      const item = await Ingredient.create({
        name,
        normalizedName: name.toLocaleLowerCase("fa-IR"),
        iconId: icon,
      });
      return ingredientOutput(item);
    } catch (error) {
      if (duplicate(error))
        throw new CatalogConflict("Ingredient already exists.");
      throw error;
    }
  });
}
export async function updateIngredient(
  id: string,
  input: Record<string, unknown>,
) {
  return withCatalogReferenceLock(async () => {
    const name = requiredName(input.name, 80);
    const icon = await imageId(input.iconId, true);
    await ensureUniqueIndex(Ingredient, "normalizedName");
    try {
      const item = await Ingredient.findOneAndUpdate(
        { _id: idValue(id), deletedAt: null },
        {
          $set: {
            name,
            normalizedName: name.toLocaleLowerCase("fa-IR"),
            iconId: icon,
          },
        },
        { new: true, runValidators: true },
      ).lean();
      if (!item) throw new CatalogNotFound();
      return ingredientOutput(item);
    } catch (error) {
      if (duplicate(error))
        throw new CatalogConflict("Ingredient already exists.");
      throw error;
    }
  });
}
/** Archive instead of hard delete: historical references retain their target. */
export async function archiveItem(
  kind: "categories" | "ingredients",
  id: string,
) {
  return withCatalogReferenceLock(async () => {
    const target = idValue(id);
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database is not connected.");
    const references =
      kind === "categories"
        ? { categoryId: target }
        : { ingredientIds: target };
    if (
      await db
        .collection("products")
        .findOne({ ...references, deletedAt: null }, { projection: { _id: 1 } })
    )
      throw new CatalogReferenced("Active products refer to this item.");
    if (
      kind === "categories" &&
      (await Category.exists({ parentId: target, deletedAt: null }))
    )
      throw new CatalogReferenced(
        "Active subcategories refer to this category.",
      );
    const model = kind === "categories" ? Category : Ingredient;
    const result = await model.updateOne(
      { _id: target, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (!result.modifiedCount) throw new CatalogNotFound();
  });
}
async function orderState() {
  try {
    await CategoryOrder.updateOne(
      { _id: "homepage" },
      { $setOnInsert: { ids: [], revision: 0 } },
      { upsert: true },
    );
  } catch (error) {
    if (!duplicate(error)) throw error;
  }
  return CategoryOrder.findById("homepage").lean();
}
async function orderedCategories() {
  const [state, categories] = await Promise.all([
    CategoryOrder.findById("homepage").lean(),
    Category.find({ deletedAt: null }).sort({ createdAt: 1, _id: 1 }).lean(),
  ]);
  const byId = new Map(categories.map((item) => [String(item._id), item]));
  const ordered: typeof categories = [];
  for (const item of state?.ids ?? []) {
    const id = String(item);
    const category = byId.get(id);
    if (category) {
      ordered.push(category);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  return { categories: ordered, revision: state?.revision ?? 0 };
}
export async function categoryOrdering() {
  const { categories, revision } = await orderedCategories();
  if (categories.length > 5000)
    throw new RangeError("Too many categories to reorder.");
  return {
    items: categories.map((item) => ({
      id: String(item._id),
      name: item.name,
      imageId: item.imageId ?? null,
      iconId: item.iconId ?? null,
      parentId: item.parentId ?? null,
    })),
    revision,
  };
}
function validateSearch(query: string, page: number, limit: number) {
  if (
    query.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(query) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw new RangeError("Invalid search or pagination.");
}
export async function listCategories(
  query: string,
  page: number,
  limit: number,
) {
  validateSearch(query, page, limit);
  const { categories, revision } = await orderedCategories();
  const text = query.trim().normalize("NFKC").toLocaleLowerCase("fa-IR");
  const roots = categories.filter((item) => !item.parentId);
  const grouped = roots.flatMap((root) => [
    root,
    ...categories.filter((item) => item.parentId === String(root._id)),
  ]);
  const names = new Map(
    categories.map((item) => [String(item._id), item.name]),
  );
  const filtered = grouped.filter((item) =>
    item.name.normalize("NFKC").toLocaleLowerCase("fa-IR").includes(text),
  );
  return {
    items: filtered.slice((page - 1) * limit, page * limit).map((item) => ({
      ...categoryOutput(item),
      parentName: item.parentId ? (names.get(item.parentId) ?? null) : null,
    })),
    total: filtered.length,
    page,
    limit,
    revision,
  };
}
export async function listIngredients(
  query: string,
  page: number,
  limit: number,
) {
  validateSearch(query, page, limit);
  const search = query.trim().normalize("NFKC").toLocaleLowerCase("fa-IR");
  const filter = {
    deletedAt: null,
    ...(search
      ? {
          normalizedName: {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    Ingredient.find(filter)
      .sort({ normalizedName: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Ingredient.countDocuments(filter),
  ]);
  return { items: items.map(ingredientOutput), total, page, limit };
}
/** Atomically update one order document; categories created concurrently are appended on subsequent reads. */
export async function moveCategory(
  id: string,
  target: string,
  placement: "before" | "after",
  expectedRevision: number,
) {
  return withCatalogReferenceLock(async () => {
    const sourceId = idValue(id),
      targetId = idValue(target);
    if (
      sourceId === targetId ||
      !["before", "after"].includes(placement) ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    )
      throw new RangeError("Invalid move.");
    await orderState();
    const { categories, revision } = await orderedCategories();
    if (revision !== expectedRevision)
      throw new CatalogConflict("Order changed.");
    const ids = categories.map((category) => String(category._id));
    const from = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (from < 0 || targetIndex < 0) throw new CatalogNotFound();
    if (
      (categories[from].parentId ?? null) !==
      (categories[targetIndex].parentId ?? null)
    )
      throw new RangeError("Categories can only be reordered among siblings.");
    ids.splice(from, 1);
    const destination = ids.indexOf(targetId) + (placement === "after" ? 1 : 0);
    ids.splice(destination, 0, sourceId);
    if (ids.length > 5000)
      throw new RangeError("Too many categories to reorder.");
    const result = await CategoryOrder.updateOne(
      { _id: "homepage", revision: expectedRevision },
      {
        $set: { ids: ids.map((value) => new mongoose.Types.ObjectId(value)) },
        $inc: { revision: 1 },
      },
    );
    if (!result.modifiedCount) throw new CatalogConflict("Order changed.");
  });
}
