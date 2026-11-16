import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";
import sharp from "sharp";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import { storeMedia } from "../../src/server/media/storage.ts";
import {
  Category,
  Ingredient,
  CategoryOrder,
  createCategory,
  updateCategory,
  createIngredient,
  updateIngredient,
  archiveItem,
  listCategories,
  listIngredients,
  moveCategory,
} from "../../src/server/catalog/catalog.ts";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const image = await storeMedia(png, "icon.png", "image/png");
  await assert.rejects(createCategory({ name: "بدون شاخص" }));
  for (let i = 0; i < 2; i++) {
    const indexRun = spawnSync(
      process.execPath,
      ["--conditions=react-server", "scripts/catalog-indexes.mjs"],
      { env: process.env, encoding: "utf8", timeout: 30000 },
    );
    assert.equal(indexRun.status, 0, indexRun.stderr);
  }
  const input = {
    name: "ساندویچ",
    excerpt: "نمونه",
    imageId: image.id,
    iconId: image.id,
  };
  const a = await createCategory(input);
  const b = await createCategory(input);
  assert.notEqual(a.slug, b.slug);
  assert.ok([a.slug, b.slug].includes("ساندویچ"));
  assert.equal(a.seo.title, "ساندویچ | بهارمز");
  const c = await createCategory({ name: "سالاد" });
  const updated = await updateCategory(a.id, { ...input, name: "نام تازه" });
  assert.equal(updated.slug, a.slug);
  assert.equal(updated.seo.title, "نام تازه | بهارمز");
  await assert.rejects(
    createCategory({ name: "نمونه", imageId: "000000000000000000000000" }),
  );
  const ingredient = await createIngredient({ name: "پنیر", iconId: image.id });
  await assert.rejects(createIngredient({ name: "پنیر", iconId: image.id }));
  await assert.rejects(createIngredient({ name: "مرغ" }));
  assert.equal(
    (
      await updateIngredient(ingredient.id, {
        name: "پنیر تازه",
        iconId: image.id,
      })
    ).name,
    "پنیر تازه",
  );
  assert.equal((await listIngredients("تازه", 1, 24)).total, 1);
  assert.equal((await listIngredients("(", 1, 24)).total, 0);
  let current = await listCategories("", 1, 24);
  const before = current.items.map((item) => item.id);
  await moveCategory(c.id, before[0], "before", current.revision);
  current = await listCategories("", 1, 24);
  assert.equal(current.items[0].id, c.id);
  await assert.rejects(
    moveCategory(a.id, b.id, "before", current.revision - 1),
  );
  const newItem = await createCategory({ name: "پیش‌غذا" });
  assert.equal((await listCategories("", 1, 24)).items.at(-1).id, newItem.id);
  const oldRevision = current.revision;
  const races = await Promise.allSettled([
    moveCategory(a.id, b.id, "before", oldRevision),
    moveCategory(b.id, a.id, "before", oldRevision),
  ]);
  assert.equal(
    races.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const child = await createCategory({ name: "زیر دسته", parentId: a.id });
  assert.equal(child.parentId, a.id);
  const child2 = await createCategory({ name: "زیردسته دوم", parentId: a.id });
  let hierarchyOrder = await listCategories("", 1, 24);
  await assert.rejects(
    moveCategory(child.id, b.id, "before", hierarchyOrder.revision),
    RangeError,
  );
  await moveCategory(child2.id, child.id, "before", hierarchyOrder.revision);
  hierarchyOrder = await listCategories("", 1, 24);
  assert.ok(
    hierarchyOrder.items.findIndex((item) => item.id === child2.id) <
      hierarchyOrder.items.findIndex((item) => item.id === child.id),
  );
  const hierarchy = await listCategories("زیر دسته", 1, 24);
  assert.equal(hierarchy.items[0].parentName, "نام تازه");
  await assert.rejects(
    createCategory({ name: "سطح سوم", parentId: child.id }),
    RangeError,
  );
  await assert.rejects(
    updateCategory(a.id, { ...input, parentId: b.id }),
    RangeError,
  );
  await assert.rejects(
    updateCategory(child.id, { name: "زیر دسته", parentId: child.id }),
    RangeError,
  );
  await assert.rejects(archiveItem("categories", a.id));
  await archiveItem("categories", child.id);
  await archiveItem("categories", child2.id);
  await archiveItem("categories", a.id);
  await archiveItem("ingredients", ingredient.id);
  assert.ok((await Category.findById(a.id)).deletedAt);
  assert.ok((await Ingredient.findById(ingredient.id)).deletedAt);
  assert.equal((await listCategories("نام تازه", 1, 24)).total, 0);
  assert.ok(
    await mongoose.connection.db
      .collection("media.files")
      .findOne({ _id: new mongoose.mongo.ObjectId(image.id) }),
  );
  assert.ok((await CategoryOrder.findById("homepage")).revision > 0);
  await mongoose.disconnect();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    autoIndex: false,
  });
  assert.equal((await listCategories("", 1, 24)).items[0].id, c.id);
  console.log(
    "Catalog integration passed: media references, unique slugs, ordering, concurrency and archives.",
  );
} finally {
  await mongoose.disconnect();
}
