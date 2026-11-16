import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeRichDescription } from "../src/server/products/rich-description.ts";

test("rich descriptions retain supported formatting and remove unsafe markup", () => {
  const input =
    'rich:v1:<h2 style="text-align:center">عنوان</h2><p><strong>متن</strong> <a href="javascript:alert(1)" onclick="alert(1)">پیوند</a><img src=x onerror=alert(1)><script>alert(1)</script></p>';
  const result = sanitizeRichDescription(input);
  assert.match(result, /<h2 style="text-align:center">عنوان<\/h2>/);
  assert.match(result, /<strong>متن<\/strong>/);
  assert.doesNotMatch(result, /javascript|onclick|onerror|<script|<img/);
});

test("legacy descriptions remain plain text and safe links keep safe attributes", () => {
  assert.equal(sanitizeRichDescription("<b>legacy</b>"), "<b>legacy</b>");
  const result = sanitizeRichDescription(
    'rich:v1:<p><a href="https://example.com">پیوند</a></p>',
  );
  assert.match(result, /href="https:\/\/example.com"/);
  assert.match(result, /rel="noopener noreferrer nofollow"/);
});

test("editor color and font size survive sanitization", () => {
  const result = sanitizeRichDescription(
    'rich:v1:<p style="text-align: right;"><span style="color: rgb(83, 25, 30); font-size: 18px;">نمونه</span></p>',
  );
  assert.match(result, /color:rgb\(83,\s*25,\s*30\)/);
  assert.match(result, /font-size:18px/);
});

test("tables and typography survive while unsafe attributes are removed", () => {
  const result = sanitizeRichDescription(
    'rich:v1:<table><tbody><tr><th colspan="2">عنوان</th></tr><tr><td><p><sub>۲</sub><sup>۳</sup></p></td></tr></tbody></table>',
  );
  assert.match(result, /<table>/);
  assert.match(result, /colspan="2"/);
  assert.match(result, /<sub>۲<\/sub>/);
  assert.match(result, /<sup>۳<\/sup>/);
});

test("editor-generated table structure is preserved without layout attributes", () => {
  const result = sanitizeRichDescription(
    'rich:v1:<table style="min-width:75px"><colgroup><col style="min-width:25px"></colgroup><tbody><tr><th><p>عنوان</p></th><td><p>مقدار</p></td></tr></tbody></table>',
  );
  assert.match(
    result,
    /<table><tbody><tr><th><p>عنوان<\/p><\/th><td><p>مقدار<\/p><\/td><\/tr><\/tbody><\/table>/,
  );
  assert.doesNotMatch(result, /colgroup|min-width/);
});
