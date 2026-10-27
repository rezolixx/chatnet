import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/app/blog/blog.css", import.meta.url), "utf8");

test("full article cover remains visible without cropping square photographs", () => {
  assert.match(css, /\.chatnet-blog-article-cover img\s*\{\s*object-fit: contain;/);
  assert.doesNotMatch(css, /\.chatnet-blog-article-cover img\s*\{\s*object-fit: cover;/);
  assert.match(css, /\.chatnet-blog-article-cover \{[^}]*height: clamp\(360px, 55vw, 680px\)/);
  assert.match(css, /\.chatnet-blog-article-cover \{ height: min\(90vw, 430px\);/);
});

test("compact article list cards keep their intended crop", () => {
  assert.match(css, /\.chatnet-blog-card-media img \{ object-fit: cover;/);
});
