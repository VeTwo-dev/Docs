# Example: Node.js Application

This example demonstrates how to use `@vetwo/docs` in a Node.js application project.

## What this example shows

- Documenting a server application
- API reference pages for server endpoints
- Custom sidebar grouping
- SEO configuration for production deployment

## Structure

```
node-app/
  docs/
    index.md              # Overview page
    api/
      server.md           # Server API documentation
  src/
    server.ts             # Simple HTTP server
  docs.config.ts          # @vetwo/docs configuration
  package.json
```

## Getting started

```bash
npm install
npx docs build
```

## Running the server

```bash
npm start
```

The server will start on `http://localhost:3000`.
