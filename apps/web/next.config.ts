import { createRequire } from "node:module";
import path from "node:path";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // @fabric/ui ships raw TSX (main: ./src/index.ts) — Next must transpile it.
  // @react-three/drei ships untranspiled ESM helpers that need the same treatment.
  transpilePackages: ["@fabric/ui", "@react-three/drei"],
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // The @effect-atom/atom-react barrel re-exports @effect-atom/atom/AtomRpc, which
  // imports @effect/platform/MsgPack. We don't use RPC anywhere in the web app
  // (RegistryProvider is the only atom-react symbol we import), so the import
  // is dead at build time. Stub it out to a no-op module so webpack doesn't
  // try to resolve a missing named export (`Msgpackr`) from the upstream
  // @effect/platform package. Note: Turbopack does not support boolean aliases;
  // we keep this scoped to webpack via the next build script (`--webpack`).
  //
  // Same treatment for @wagmi/connectors' optional wallet SDKs. The app only
  // uses `injected` and `walletConnect`; the other connectors' peer-deps
  // (base, coinbase, metamask, safe) are NOT installed and never invoked.
  // The wagmi barrel still imports their files statically, so we stub them
  // at the resolver level. The `porto` and `porto/internal` (a subpath
  // dynamic import) are silenced via webpack.IgnorePlugin — they are loaded
  // via `import('porto/internal')` inside @wagmi/connectors/porto.js which
  // bypasses the static resolve.alias. IgnorePlugin skips them entirely.
  webpack(config) {
    config.resolve = config.resolve ?? {};
    const stub = () => path.resolve(__dirname, "src/stubs/empty-module.js");
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string> | undefined),
      "@effect/platform/MsgPack": path.resolve(
        __dirname,
        "src/stubs/effect-platform-msgpack.js"
      ),
      // wagmi/connectors optional wallet SDKs — never invoked by the app.
      "@base-org/account": stub(),
      "@coinbase/wallet-sdk": stub(),
      "@metamask/sdk": stub(),
      "@safe-global/safe-apps-sdk": stub(),
      "@safe-global/safe-apps-provider": stub(),
      "@walletconnect/ethereum-provider": stub(),
    };
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      new (require("webpack").IgnorePlugin)({
        resourceRegExp: /^porto(\/internal)?$/,
        contextRegExp: /@wagmi\/connectors/,
      })
    );
    return config;
  },
};

export default nextConfig;
