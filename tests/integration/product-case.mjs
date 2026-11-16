import assert from "node:assert/strict";
import mongoose from "mongoose";
import sharp from "sharp";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import {
  Category,
  Ingredient,
  createCategory,
  createIngredient,
  archiveItem,
} from "../../src/server/catalog/catalog.ts";
import { withCatalogReferenceLock } from "../../src/server/catalog/reference-lock.ts";
import {
  Product,
  createProduct,
  updateProduct,
  changeProductPrice,
  archiveProduct,
  getProduct,
  listProducts,
} from "../../src/server/products/products.ts";
import { storeMedia } from "../../src/server/media/storage.ts";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  await Category.createIndexes();
  await Ingredient.createIndexes();
  await Product.createIndexes();
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const image = await storeMedia(png, "icon.png", "image/png");
  const category = await createCategory({ name: "غذا" });
  const ingredient = await createIngredient({ name: "پنیر", iconId: image.id });
  const input = {
    title: "مینی ساندویچ",
    excerpt: "پذیرایی",
    description: "متن نمونه",
    gallery: [image.id],
    categoryId: category.id,
    ingredientIds: [ingredient.id],
    priceRials: 2450000,
    discountPriceRials: 2000000,
    promoted: true,
    available: true,
  };
  const one = await createProduct(input);
  const two = await createProduct(input);
  assert.notEqual(one.slug, two.slug);
  assert.equal(one.seo.title, "مینی ساندویچ | بهارمز");
  assert.equal(one.seo.description, "پذیرایی");
  for (const bad of [0, -10, 10.5, 9, Number.MAX_SAFE_INTEGER])
    await assert.rejects(createProduct({ ...input, priceRials: bad }));
  for (const bad of [0, 9, input.priceRials, input.priceRials + 10])
    await assert.rejects(createProduct({ ...input, discountPriceRials: bad }));
  await assert.rejects(
    createProduct({ ...input, categoryId: "000000000000000000000000" }),
  );
  await assert.rejects(
    createProduct({ ...input, ingredientIds: ["000000000000000000000000"] }),
  );
  await assert.rejects(
    createProduct({ ...input, gallery: ["000000000000000000000000"] }),
  );
  await assert.rejects(
    createProduct({ ...input, gallery: [image.id, image.id] }),
  );
  const updated = await updateProduct(one.id, {
    ...input,
    revision: one.revision,
    title: "عنوان تازه",
  });
  assert.equal(updated.slug, one.slug);
  assert.equal(updated.seo.title, "عنوان تازه | بهارمز");
  await assert.rejects(
    updateProduct(one.id, { ...input, revision: one.revision }),
  );
  const priced = await changeProductPrice(one.id, {
    revision: updated.revision,
    priceRials: 3000000,
    discountPriceRials: 2500000,
  });
  assert.equal(priced.priceRials, 3000000);
  assert.equal(priced.revision, updated.revision + 1);
  await assert.rejects(
    changeProductPrice(one.id, {
      revision: updated.revision,
      priceRials: 1000,
      discountPriceRials: null,
    }),
  );
  assert.equal(
    (
      await listProducts({
        query: "عنوان",
        availability: "available",
        promotion: "promoted",
        page: 1,
        limit: 20,
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await listProducts({
        query: "(",
        availability: "all",
        promotion: "all",
        page: 1,
        limit: 20,
      })
    ).total,
    0,
  );
  await assert.rejects(archiveItem("categories", category.id));
  await assert.rejects(archiveItem("ingredients", ingredient.id));
  await assert.rejects(
    withCatalogReferenceLock(async () => {
      throw new Error("expected");
    }),
  );
  await withCatalogReferenceLock(async () => {});
  const locks = mongoose.connection.db.collection("catalog_reference_locks");
  await locks.insertOne({
    _id: "global",
    owner: "test-abandoned",
    createdAt: new Date(),
  });
  await assert.rejects(createProduct(input));
  await locks.deleteOne({ _id: "global", owner: "test-abandoned" });
  await archiveProduct(one.id, priced.revision);
  await archiveProduct(two.id, two.revision);
  assert.ok((await Product.findById(one.id)).deletedAt);
  await archiveItem("categories", category.id);
  await archiveItem("ingredients", ingredient.id);
  await assert.rejects(createProduct(input));
  const raceCategory = await createCategory({ name: "رقابت" });
  const concurrent = await Promise.allSettled([
    createProduct({
      ...input,
      title: "محصول رقابتی",
      categoryId: raceCategory.id,
      ingredientIds: [],
    }),
    archiveItem("categories", raceCategory.id),
  ]);
  assert.ok(concurrent.some((entry) => entry.status === "fulfilled"));
  const raceRecord = await Category.findById(raceCategory.id);
  const activeReferences = await Product.countDocuments({
    categoryId: raceCategory.id,
    deletedAt: null,
  });
  assert.equal(Boolean(raceRecord.deletedAt) && activeReferences > 0, false);
  await mongoose.disconnect();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    autoIndex: false,
  });
  assert.ok((await Product.findById(one.id)).deletedAt);
  await assert.rejects(getProduct(one.id));
  console.log(
    "Product integration passed: prices, references, slugs, revisions and safe archival.",
  );
} finally {
  await mongoose.disconnect();
}
