import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/app/blog/blog.css", import.meta.url), "utf8");

test("article cover fills the width without cropping square photographs", () => {
  assert.match(css, /\.chatnet-blog-article-cover img \{ display: block; width: 100%; height: auto; object-fit: contain; \}/);
  assert.doesNotMatch(css, /\.chatnet-blog-article-cover \{[^}]*height: clamp\(/);
  assert.doesNotMatch(css, /\.chatnet-blog-article-cover img\s*\{\s*object-fit: cover;/);
  const page = readFileSync(new URL("../src/app/blog/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /width=\{1200\} height=\{1200\}/);
  assert.doesNotMatch(page, /article\.cover\.alt\} fill/);
});

test("compact article list cards keep their intended crop", () => {
  assert.match(css, /\.chatnet-blog-card-media img \{ object-fit: cover;/);
});
