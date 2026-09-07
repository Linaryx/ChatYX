import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

function normalizeBase(base: string): string {
  if (!base || base === "/") return "/";
  if (base === "." || base === "./") return "./";
  return `/${base.replace(/^\/+|\/+$/g, "")}/`;
}

function getPagesBase(): string {
  if (process.env.VITE_BASE_PATH) {
    return normalizeBase(process.env.VITE_BASE_PATH);
  }

  return process.env.GITHUB_ACTIONS ? "./" : "/";
}

export default defineConfig({
  base: getPagesBase(),
  plugins: [tailwindcss(), solid({
      ssr: false,
    }),],
  resolve: {
    alias: {
      "~": srcDir,
    },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    reportCompressedSize: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Keep the framework cacheable independently from application code.
            {
              name: "framework",
              test: /[\\/]node_modules[\\/](solid-js|@solidjs)[\\/]/,
              priority: 30,
            },
            // The setup screen's controls and icons change together more often
            // than the framework, so give the UI stack its own cache boundary.
            {
              name: "ui",
              test: /[\\/]node_modules[\\/](?:@kobalte|@corvu|@floating-ui|@internationalized|@solid-primitives|lucide-solid|lucid-color-picker|solid-presence|solid-prevent-scroll)[\\/]/,
              priority: 20,
            },
            // Tiny utility packages are shared broadly but are independent of
            // both the framework and UI components.
            {
              name: "utilities",
              test: /[\\/]node_modules[\\/](?:clsx|tailwind-merge|class-variance-authority)[\\/]/,
              priority: 10,
            },
            {
              name: "index",
              tags: ["$initial"],
            },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    // The setup route is the default page. Cache its transform graph before
    // the first browser request so the initial navigation has no JSX waterfall.
    warmup: {
      clientFiles: ["./src/index.tsx", "./src/routes/setup.tsx"],
    },
    watch: {
      ignored: ["**/codesnippets/**"],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
