import { expect, test } from "vitest";
import type { InlangPlugin } from "@inlang/sdk";
import { plugin } from "./plugin.js";

// Compile-time check: the modern plugin surface must satisfy the real SDK
// contract. (The legacy loadMessages/saveMessages callbacks intentionally
// use narrower filesystem types, matching the official JSON plugin.)
const _modernContract: Pick<
  InlangPlugin,
  "id" | "key" | "toBeImportedFiles" | "importFiles" | "exportFiles"
> = {
  id: plugin.id,
  key: plugin.key,
  toBeImportedFiles: plugin.toBeImportedFiles,
  importFiles: plugin.importFiles,
  exportFiles: plugin.exportFiles,
};

test("retains legacy callbacks alongside the modern resource-plugin contract", () => {
  expect(plugin.id).toBe("plugin.felixhaeberle.yaml");
  expect(plugin.key).toBe("plugin.felixhaeberle.yaml");
  expect(plugin.settingsSchema).toBeDefined();
  expect(plugin.loadMessages).toBeTypeOf("function");
  expect(plugin.saveMessages).toBeTypeOf("function");
  expect(plugin.toBeImportedFiles).toBeTypeOf("function");
  expect(plugin.importFiles).toBeTypeOf("function");
  expect(plugin.exportFiles).toBeTypeOf("function");
});
