# inlang-plugin-yaml

This is a yaml plugin for using translations resources in the yaml format with [inlang](https://inlang.com/documentation/plugins)].

## Usage

Plugins can be imported directly from GitHub releases via jsDelivr.

```js
// filename: inlang.config.js

export async function defineConfig(env) {
  const { default: pluginYaml } = await env.$import(
    "https://cdn.jsdelivr.net/gh/felixhaeberle/inlang-plugin-yaml@{version}/dist/index.js"
  );

  return {
    // other properties...
    plugins: [
      pluginYaml({
        pathPattern: "./example/{language}.yml",
      }),
    ],
  };
}
```

The [dist](./dist/) directory is used to distribute the plugin directly via CDN like [jsDelivr](https://www.jsdelivr.com/). Using a CDN works because the inlang config uses dynamic imports to import plugins. Read the [jsDelivr documentation](https://www.jsdelivr.com/?docs=gh) on importing from GitHub.

For additional usage information, take a look at [example](./example/).

## Developing

Run the following commands in your terminal (node and npm must be installed):

1. `npm install`
2. `npm run dev`

`npm run dev` will start the development environment which automatically compiles the [src/index.ts](./src/index.ts) files to JavaScript ([dist/index.js](dist/index.js)), runs tests defined in `*.test.ts` files and watches changes.

## Publishing

1. Run `npm run build` to generate a build.
2. Commit the new build.
3. Create a new release on GitHub that uses [Semantic Versioning (SemVer)](https://semver.org/). Take a look at [inlang-plugin-json](https://github.com/samuelstroschein/inlang-plugin-json/releases) for example releases.
4. (Optional) Open a pull request to https://github.com/inlang/ecosystem

Note:

- tags are used without "v" at the beginning like: New Tag: 1.2.2
- JSdeliver cached your plugin for `one week`. If you published a new Version and you want to debug something, you have to specify your version in the link like: ....standard-lint-rules@1.2.2/dist/index.js"

![](https://camo.githubusercontent.com/dcc07ce55f0484b41bb7ca0b55bd43475e866521d47f7ce1bf997715416de2e9/68747470733a2f2f63646e2e646973636f72646170702e636f6d2f6174746163686d656e74732f3930323533313033353830363433333238302f313036363736373833363039393338333332362f436c65616e53686f745f323032332d30312d32325f61745f31322e31342e303932782e706e67)
