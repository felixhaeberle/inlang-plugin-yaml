import type * as ast from "@inlang/core/ast";

import type { Config, EnvironmentFunctions } from "@inlang/core/config";

import flatten from "flat";
import safeSet from 'just-safe-set';
import yaml from "js-yaml";

/**
 * The plugin configuration.
 */
export type PluginConfig = {
  /**
   * Defines the path pattern for the resources.
   *
   * Must include the `{language}` placeholder.
   *
   * @example
   *  "./resources/{language}.json"
   */
  pathPattern: string;
};

/**
 * Automatically derives the languages in this repository.
 */
export async function getLanguages(
  args: EnvironmentFunctions & {
    pluginConfig: PluginConfig;
    referenceLanguage: string;
  }
) {
  // replace the path
  const [pathBeforeLanguage, pathAfterLanguage] =
    args.pluginConfig.pathPattern.split("{language}");

  // prepared for different folder structure e.g. example/language/translation.json
  // see plugin.po
  const pathAfterLanguageIsDirectory = pathAfterLanguage.startsWith("/");

  const paths = await args.$fs.readdir(pathBeforeLanguage);
  // files that end with .json
  const languages = [];

  for (const language of paths) {
    // remove the .yml or .yaml extension to only get language name
    if (typeof language === "string" && (language.endsWith(".yml") || language.endsWith(".yaml"))) {
      languages.push(language.replace(/\.ya?ml$/, ""));
    }
  }

  return languages;
}

/**
 * Reading resources.
 *
 * The function merges the args from Config['readResources'] with the pluginConfig
 * and EnvironmentFunctions.
 */
export async function readResources(
  // merging the first argument from config (which contains all arguments)
  // with the custom pluginConfig argument
  args: Parameters<Config["readResources"]>[0] &
    EnvironmentFunctions & { pluginConfig: PluginConfig }
): ReturnType<Config["readResources"]> {
  const result: ast.Resource[] = [];
  for (const language of args.config.languages) {
    const resourcePath = args.pluginConfig.pathPattern.replace(
      "{language}",
      language
    );
    const yamlBuffer = await args.$fs.readFile(resourcePath, {encoding: "utf-8"});
    const yamlObject = yaml.load(yamlBuffer as string) as Record<string, string>;

    // reading the json, and flattening it to avoid nested keys.
    const flatJson = flatten(yamlObject) as Record<string, string>;
    result.push(parseResource(flatJson, language));
  }  
  
  return result;
}

/**
 * Writing resources.
 *
 * The function merges the args from Config['readResources'] with the pluginConfig
 * and EnvironmentFunctions.
 */
export async function writeResources(
  args: Parameters<Config["writeResources"]>[0] &
    EnvironmentFunctions & { pluginConfig: PluginConfig }
): ReturnType<Config["writeResources"]> {
  for (const resource of args.resources) {
    const resourcePath = args.pluginConfig.pathPattern.replace(
      "{language}",
      resource.languageTag.name
    );
    // save json to yml file
    const yamlString = yaml.dump(JSON.parse(serializeResource(resource)));
    await args.$fs.writeFile(resourcePath, yamlString);
  }
}

/**
 * Parses a resource.
 */
function parseResource(
  yamlObject: Record<string, string>,
  language: string
): ast.Resource {
  return {
    type: "Resource",
    languageTag: {
      type: "LanguageTag",
      name: language,
    },
    body: Object.entries(yamlObject).map(([id, value]) =>
      parseMessage(id, value)
    ),
  };
}

/**
 * Parses a message.
 *
 * @example
 *  parseMessage("test", "Hello world")
 */
function parseMessage(id: string, value: string): ast.Message {
  return {
    type: "Message",
    id: {
      type: "Identifier",
      name: id,
    },
    pattern: { type: "Pattern", elements: [{ type: "Text", value: value }] },
  };
}

/**
 * Serializes a resource.
 *
 * The function unflattens, and therefore reverses the flattening
 * in parseResource, of a given object. The result is a stringified JSON
 * that is beautified by adding (null, 2) to the arguments.
 *
 * @example
 *  serializeResource(resource)
 */
function serializeResource(resource: ast.Resource): string {
    const obj = {}
    resource.body.forEach(message => {
      const [key, value] = serializeMessage(message)
      safeSet(obj, key, value);
    });
    // stringify the object with beautification.
    return JSON.stringify(obj, null, 2);
}

/**
 * Serializes a message.
 *
 * Note that only the first element of the pattern is used as inlang, as of v0.3,
 * does not support more than 1 element in a pattern.
 */
function serializeMessage(message: ast.Message): [id: string, value: string] {
  return [message.id.name, message.pattern.elements[0].value as string];
}
