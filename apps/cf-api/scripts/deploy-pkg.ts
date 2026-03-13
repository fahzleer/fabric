import pkg from "../package.json";

const deployPkg = {
  name: pkg.name,
  version: pkg.version,
  type: "module",
  main: "index.js",
  engines: { node: ">=22" },
  dependencies: {
    "firebase-admin": pkg.dependencies["firebase-admin"],
    "firebase-functions": pkg.dependencies["firebase-functions"],
  },
};

await Bun.write("dist/package.json", JSON.stringify(deployPkg, null, 2));
console.log("✓ dist/package.json written");

const envProd = Bun.file(".env.production");
if (await envProd.exists()) {
  await Bun.write("dist/.env.production", envProd);
  console.log("✓ dist/.env.production copied");
}
