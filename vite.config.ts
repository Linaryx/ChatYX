import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

function normalizeBase(base: string): string {
  if (!base || base === "/") return "/";
  return `/${base.replace(/^\/+|\/+$/g, "")}/`;
}

function getPagesBase(): string {
  if (process.env.VITE_BASE_PATH) {
    return normalizeBase(process.env.VITE_BASE_PATH);
  }

  if (!process.env.GITHUB_ACTIONS) return "/";

  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
  if (!repoName || repoName.endsWith(".github.io")) return "/";

  return normalizeBase(repoName);
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
    port: 3000,
    watch: {
      ignored: ["**/codesnippets/**"],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
