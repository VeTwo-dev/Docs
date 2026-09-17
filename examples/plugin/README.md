# Example: Custom Plugin

This example demonstrates how to create and use a custom plugin with `@vetwo/docs`.

## What this example shows

- Writing a custom plugin with lifecycle hooks
- Registering plugins in `docs.config.ts`
- Using multiple hooks in a single plugin
- Accessing the build context and logger from hooks

## Structure

```
plugin/
  plugins/
    my-plugin.ts          # Custom plugin implementation
  docs/
    index.md              # Landing page
  docs.config.ts          # @vetwo/docs configuration with plugin
  package.json
```

## Getting started

```bash
npm install
npx docs build
```

The custom plugin will run during the build process, logging messages at each lifecycle stage.
