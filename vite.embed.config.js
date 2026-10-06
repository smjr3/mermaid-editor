import { defineConfig } from 'vite';

// Builds the standalone <mermaid-embed> loader (src/embed-loader.ts) into static/embed.js,
// which the SvelteKit build then ships verbatim as /embed.js. Run via `pnpm build:embed`
// (chained into `pnpm dev` and `pnpm build`); the output file is gitignored.
export default defineConfig({
  // This config has no SvelteKit plugin, so Vite's publicDir would default to
  // "public" — a directory some static hosts publish from. With outDir "static",
  // a build run after `pnpm build:pages` would copy the entire generated site
  // into the tracked static/ directory, and the next build would ship it. The
  // embed bundle is a single library entry with no public assets, so switch it off.
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/embed-loader.ts',
      fileName: () => 'embed.js',
      formats: ['iife'],
      name: 'mermaidEmbed'
    },
    minify: false,
    outDir: 'static'
  }
});
