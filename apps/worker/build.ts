import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

if (!existsSync(join(rootDir, "src", "client", "main.tsx"))) {
  console.error("❌ Must run from project root — expected ./src/client/main.tsx");
  process.exit(1);
}

const timestamp = Date.now();

const result = await Bun.build({
  entrypoints: ["./src/client/main.tsx"],
  outdir: "./public/js",
  target: "browser",
  format: "esm",
  splitting: false,
  minify: false,
  sourcemap: "external",
  naming: {
    entry: `main.${timestamp}.js`,
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const indexPath = "./public/index.html";
let indexHtml = readFileSync(indexPath, "utf-8");

indexHtml = indexHtml.replace(
  /<script type="module" src="\/js\/main\.\d+\.js"><\/script>/,
  `<script type="module" src="/js/main.${timestamp}.js"></script>`
);

indexHtml = indexHtml.replace(
  /<script type="module" src="\/js\/main\.js"><\/script>/,
  `<script type="module" src="/js/main.${timestamp}.js"></script>`
);

writeFileSync(indexPath, indexHtml);

console.log(`✅ Built main.${timestamp}.js`);
