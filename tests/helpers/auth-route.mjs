import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));

// Execute the real route and bridge helpers with real NextRequest/NextResponse,
// replacing only the network and the server-only bundler marker.
export function loadAuthRoute(name, fetch) {
  const modules = new Map();
  const context = vm.createContext({ fetch, Headers, Response, Request, AbortSignal, TextDecoder, Uint8Array, URL, process: { env: { NODE_ENV: "production" } } });
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    const record = { exports: {} };
    modules.set(path, record);
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier.startsWith("@/")) return load(resolve(sourceRoot, `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) return load(resolve(dirname(path), `${specifier}.ts`));
      return require(specifier);
    };
    const run = vm.runInContext(`(function(require, module, exports) { ${code}\n })`, context, { filename: path });
    run(localRequire, record, record.exports);
    return record.exports;
  }
  return load(resolve(sourceRoot, `app/api/auth/${name}/route.ts`));
}
