const distDir = "dist";
const indexPath = `${distDir}/index.html`;
const fallbackPath = `${distDir}/404.html`;
const nojekyllPath = `${distDir}/.nojekyll`;

const indexHtml = await Bun.file(indexPath).text();

await Bun.write(fallbackPath, indexHtml);
await Bun.write(nojekyllPath, "");

console.log("Prepared GitHub Pages SPA fallback");
