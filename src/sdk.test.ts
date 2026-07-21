/**
 * Integration tests against the real `@inlang/sdk` package.
 *
 * These tests prove the plugin works with today's inlang: a project is
 * created with the actual SDK, files are imported through the SDK's
 * import/export pipeline, and the database state is inspected.
 */
import { expect, test } from "vitest";
import { parse } from "yaml";
import { loadProjectInMemory, newProject } from "@inlang/sdk";
import { plugin } from "./plugin.js";
import { PLUGIN_KEY } from "./pluginKey.js";

const enYaml = [
  "greeting: Hello {name}!",
  "nested:",
  "  farewell: Goodbye",
].join("\n");

const deYaml = [
  "greeting: Hallo {name}!",
  "nested:",
  "  farewell: Tschüss",
].join("\n");

async function loadTestProject() {
  return loadProjectInMemory({
    blob: await newProject({
      settings: {
        baseLocale: "en",
        locales: ["en", "de"],
        modules: [],
        [PLUGIN_KEY]: {
          pathPattern: "./messages/{locale}.yaml",
        },
      },
    }),
    providePlugins: [plugin as never],
  });
}

test("imports and exports YAML through the real SDK", async () => {
  const project = await loadTestProject();

  try {
    expect(await project.errors.get()).toEqual([]);

    const files = [
      { locale: "en", content: new TextEncoder().encode(enYaml) },
      { locale: "de", content: new TextEncoder().encode(deYaml) },
    ];
    await project.importFiles({ pluginKey: plugin.key, files });

    const bundles = await project.db.selectFrom("bundle").selectAll().execute();
    const messages = await project.db
      .selectFrom("message")
      .selectAll()
      .execute();
    const variants = await project.db
      .selectFrom("variant")
      .selectAll()
      .execute();

    expect(bundles.map((bundle) => bundle.id).sort()).toEqual([
      "greeting",
      "nested.farewell",
    ]);
    const greetingBundle = bundles.find((bundle) => bundle.id === "greeting");
    expect(greetingBundle?.declarations).toEqual([
      { type: "input-variable", name: "name" },
    ]);
    expect(messages).toHaveLength(4); // 2 bundles x 2 locales
    expect(variants).toHaveLength(4);

    const exported = await project.exportFiles({ pluginKey: plugin.key });
    const en = exported.find((file) => file.locale === "en");
    const de = exported.find((file) => file.locale === "de");
    expect(en?.name).toBe("en.yaml");
    expect(parse(new TextDecoder().decode(en!.content))).toEqual({
      greeting: "Hello {name}!",
      nested: { farewell: "Goodbye" },
    });
    expect(parse(new TextDecoder().decode(de!.content))).toEqual({
      greeting: "Hallo {name}!",
      nested: { farewell: "Tschüss" },
    });
  } finally {
    await project.close();
  }
});

test("re-importing the same files is idempotent (no duplicates)", async () => {
  const project = await loadTestProject();

  try {
    const files = [
      { locale: "en", content: new TextEncoder().encode(enYaml) },
    ];
    await project.importFiles({ pluginKey: plugin.key, files });
    await project.importFiles({ pluginKey: plugin.key, files });

    const messages = await project.db
      .selectFrom("message")
      .selectAll()
      .execute();
    const variants = await project.db
      .selectFrom("variant")
      .selectAll()
      .execute();

    expect(messages).toHaveLength(2);
    expect(variants).toHaveLength(2);
    expect(new Set(variants.map((variant) => variant.messageId))).toEqual(
      new Set(messages.map((message) => message.id)),
    );
  } finally {
    await project.close();
  }
});

test("keeps literal dotted keys and nested keys distinct through the SDK", async () => {
  const expected = {
    "a.b": "Flat",
    a: { b: "Nested" },
  };
  const project = await loadTestProject();

  try {
    const files = [
      {
        locale: "en",
        content: new TextEncoder().encode('"a.b": Flat\na:\n  b: Nested\n'),
      },
    ];
    await project.importFiles({ pluginKey: plugin.key, files });

    const [file] = await project.exportFiles({ pluginKey: plugin.key });
    expect(parse(new TextDecoder().decode(file!.content))).toEqual(expected);
  } finally {
    await project.close();
  }
});
