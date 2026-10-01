import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../src/", import.meta.url));

// Real server API helper, projection, page and JSX; replace network and Next's
// framework-only boundary to assert notFound without running a production account.
export function publicMemberModules(fetch) {
  const records = new Map();
  const context = vm.createContext({ fetch, URL, AbortSignal, process: { env: {} } });
  function load(relative) {
    let path = resolve(root, relative);
    if (!/\.tsx?$/.test(path)) path += existsSync(`${path}.ts`) ? ".ts" : ".tsx";
    if (records.has(path)) return records.get(path).exports;
    const record = { exports: {} };
    records.set(path, record);
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/navigation") return { notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); } };
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { ...props, href }, children) };
      if (specifier.startsWith("@/")) return load(specifier.slice(2));
      if (specifier.startsWith(".")) return load(resolve(dirname(path), specifier));
      return require(specifier);
    };
    vm.runInContext(`(function(require, module, exports) { ${code}\n })`, context)(localRequire, record, record.exports);
    return record.exports;
  }
  return { load };
}
