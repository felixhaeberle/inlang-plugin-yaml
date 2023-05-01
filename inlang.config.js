/**
 * @type {import("@inlang/core/config").DefineConfig}
 */
export async function defineConfig(env) {
  const { default: pluginYaml } = await env.$import("./dist/index.js");

  return {
    referenceLanguage: "en",
    plugins: [
      pluginYaml({
        pathPattern: "./example/{language}.yml",
      }),
    ],
  };
}
