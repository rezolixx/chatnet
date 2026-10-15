import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const sources = {
  "@/lib/auth/account-restriction": new URL("../../src/lib/auth/account-restriction.ts", import.meta.url),
  "@/lib/auth/member-fetch": new URL("../../src/lib/auth/member-fetch.ts", import.meta.url),
};

// The real refusal helpers and member fetch wrapper for a component harness,
// calling the harness's own fetch stub.
export function memberModules(fetch) {
  const context = vm.createContext({ fetch: (...args) => fetch(...args) });
  const modules = {};
  const load = (name) => {
    if (modules[name]) return modules[name];
    const exports = {};
    modules[name] = exports;
    const code = ts.transpileModule(readFileSync(sources[name], "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = (specifier) => load(specifier === "./account-restriction.ts" ? "@/lib/auth/account-restriction" : specifier);
    vm.runInContext(`(function(require, exports) { ${code}\n })`, context)(localRequire, exports);
    return exports;
  };
  for (const name of Object.keys(sources)) load(name);
  return modules;
}
