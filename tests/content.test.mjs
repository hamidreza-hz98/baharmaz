import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicContent,
  validateContent,
} from "../src/server/content/settings.ts";
test("empty and incomplete content has safe complete defaults", () => {
  const content = publicContent({
    homepage: { secret: "hidden" },
    seo: { about: { title: "درباره", secret: "hidden" } },
    secret: "hidden",
  });
  assert.equal(content.seo.about.title, "درباره");
  assert.deepEqual(content.contact.socials, []);
  assert.doesNotMatch(JSON.stringify(content), /hidden/);
  assert.deepEqual(validateContent(content), content);
});
test("content rejects unsafe links, unknown fields and duplicate IDs", () => {
  for (const href of [
    "//evil.invalid",
    "https://evil.invalid",
    "/\\evil.invalid",
  ]) {
    const content = publicContent({});
    content.homepage.banners = [{ id: "a", imageId: null, href, alt: "" }];
    assert.throws(() => validateContent(content));
  }
  const c = publicContent({});
  c.contact.socials = [
    { id: "a", label: "x", url: "https://user:pass@example.com" },
  ];
  assert.throws(() => validateContent(c));
  c.contact.socials = [];
  c.faq.items = [
    { id: "a", title: "a", body: "b" },
    { id: "a", title: "b", body: "c" },
  ];
  assert.throws(() => validateContent(c));
  c.faq.items = [];
  c.contact.apiKey = "secret";
  assert.throws(() => validateContent(c));
});
