import { defineConfig } from "vite";
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
  plugins: [
    solid({
      ssr: false,
    }),
  ],
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
            {
              name: "solid",
              test: /[\\/]node_modules[\\/](solid-js|@solidjs)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      ignored: ["**/codesnippets/**"],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
