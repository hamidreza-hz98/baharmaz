import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveStaticSeo,
  staticSeoCompleteness,
  staticSeoDefaults,
} from "../src/shared/static-seo.ts";
test("static metadata falls back independently for missing fields on each page", () => {
  for (const page of Object.keys(staticSeoDefaults)) {
    assert.deepEqual(resolveStaticSeo(page, { title: "  ", description: "" }), {
      title: staticSeoDefaults[page].title,
      description: staticSeoDefaults[page].description,
    });
    assert.deepEqual(
      resolveStaticSeo(page, { title: " عنوان ویژه ", description: "" }),
      { title: "عنوان ویژه", description: staticSeoDefaults[page].description },
    );
  }
});
test("completeness checks configured fields and schema length after normalization", () => {
  assert.equal(
    staticSeoCompleteness({ title: " ", description: "" }).completed,
    0,
  );
  assert.equal(
    staticSeoCompleteness({ title: "عنوان", description: " " }).completed,
    1,
  );
  assert.equal(
    staticSeoCompleteness({ title: "الف", description: "توضیح" }).completed,
    2,
  );
  assert.equal(
    staticSeoCompleteness({
      title: "x".repeat(161),
      description: "x".repeat(321),
    }).completed,
    0,
  );
  assert.equal(
    staticSeoCompleteness({
      title: "x".repeat(160),
      description: "x".repeat(320),
    }).completed,
    2,
  );
});
