import { mkdir } from "node:fs/promises";

const distDir = "dist";
const indexPath = `${distDir}/index.html`;
const fallbackPath = `${distDir}/404.html`;
const nojekyllPath = `${distDir}/.nojekyll`;
const chatDir = `${distDir}/chat`;
const setupDir = `${distDir}/setup`;
const predictionsDir = `${distDir}/predictions`;
const statusDir = `${distDir}/status`;
const rteStatusDir = `${distDir}/rtestatus`;

const indexHtml = await Bun.file(indexPath).text();
const nestedIndexHtml = indexHtml
  .replaceAll('href="./favicon.ico"', 'href="../favicon.ico"')
  .replaceAll('src="./assets/', 'src="../assets/')
  .replaceAll('href="./assets/', 'href="../assets/');

await mkdir(chatDir, { recursive: true });
await mkdir(setupDir, { recursive: true });
await mkdir(predictionsDir, { recursive: true });
await mkdir(statusDir, { recursive: true });
await mkdir(rteStatusDir, { recursive: true });

await Bun.write(fallbackPath, indexHtml);
await Bun.write(`${chatDir}/index.html`, nestedIndexHtml);
await Bun.write(`${setupDir}/index.html`, nestedIndexHtml);
await Bun.write(`${predictionsDir}/index.html`, nestedIndexHtml);
await Bun.write(`${statusDir}/index.html`, nestedIndexHtml);
await Bun.write(`${rteStatusDir}/index.html`, nestedIndexHtml);
await Bun.write(nojekyllPath, "");

console.log("Prepared GitHub Pages SPA fallback");
