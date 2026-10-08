import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as passwordPolicy from "../../src/lib/auth/password.ts";

const require = createRequire(import.meta.url);
const source = new URL("../../src/components/auth/PasswordChangeForm.tsx", import.meta.url);

// Run the actual component and event handlers with persistent hook slots.
// Only React's scheduler, the auth context and external IO are substituted;
// JSX elements and password validation use the real implementations.
export function passwordForm(fetch = async () => { throw new Error("Unexpected fetch"); }, nickname = "Member_01") {
  const slots = [];
  const navigations = [];
  const refreshes = [];
  let index = 0;
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
  };
  const localRequire = (name) => {
    if (name === "react") return hooks;
    if (name === "./AuthProvider") return { useAuth: () => ({ refreshUser: async (invalidate) => { refreshes.push(invalidate); } }) };
    if (name === "@/lib/auth/password") return passwordPolicy;
    return require(name);
  };
  const code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = vm.createContext({ fetch, window: { location: { assign: (url) => navigations.push(url) } } });
  const exports = {};
  vm.runInContext(`(function(require, exports) { ${code}\n })`, context)(localRequire, exports);
  return { render: () => { index = 0; return exports.PasswordChangeForm({ nickname }); }, navigations, refreshes };
}

export function elements(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}
