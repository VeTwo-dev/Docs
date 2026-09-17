import type { Plugin } from "@vetwo/docs";

export interface AnalyticsOptions {
  trackingId: string;
}

export function analyticsPlugin(options: AnalyticsOptions): Plugin {
  return {
    name: "example/analytics",
    version: "0.1.0",
    hooks: {
      init(ctx) {
        ctx.log.info(`[analytics] Initializing with tracking ID: ${options.trackingId}`);
      },

      discover(ctx) {
        ctx.log.info(`[analytics] Found ${ctx.ctx.sourceFiles.length} files`);
      },

      config(ctx) {
        ctx.log.debug("[analytics] Config loaded");
      },

      load(ctx) {
        ctx.log.info(`[analytics] ${ctx.ctx.pages.length} pages loaded`);
      },

      transform(ctx) {
        const script = `<script>gtag('config', '${options.trackingId}');</script>`;
        ctx.ctx.pages = ctx.ctx.pages.map((page) => ({
          ...page,
          content: `${page.content}\n\n${script}`,
        }));
        ctx.log.info(`[analytics] Injected tracking into ${ctx.ctx.pages.length} pages`);
      },

      generate(ctx) {
        ctx.log.table(
          ["Metric", "Value"],
          [
            ["Pages", String(ctx.ctx.pages.length)],
            ["Sitemap", String(ctx.ctx.sitemapEntries.length)],
            ["API Docs", String(ctx.ctx.apiDocs.length)],
          ],
        );
      },

      output(ctx) {
        ctx.log.info("[analytics] Output written");
      },

      done(ctx) {
        const duration = ((Date.now() - ctx.ctx.startTime) / 1000).toFixed(2);
        ctx.log.success(`[analytics] Build completed in ${duration}s`);
      },

      error(ctx) {
        ctx.log.error(`[analytics] Build error occurred`);
      },
    },
  };
}
