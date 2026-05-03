/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-domain-to-infrastructure",
      severity: "error",
      comment: "Domain layer must not import from infrastructure",
      from: { path: "^(apps/[^/]+/src/domain)" },
      to: { path: "^(apps/[^/]+/src/infrastructure)" },
    },
    {
      name: "no-domain-to-features",
      severity: "error",
      comment: "Domain layer must not import from features/application layer",
      from: { path: "^(apps/[^/]+/src/domain)" },
      to: { path: "^(apps/[^/]+/src/(features|application))" },
    },
    {
      name: "no-infrastructure-to-features",
      severity: "warn",
      comment: "Infrastructure should not depend on feature logic",
      from: { path: "^(apps/[^/]+/src/infrastructure)" },
      to: { path: "^(apps/[^/]+/src/features)" },
    },
    {
      name: "no-cf-api-to-cf-commerce",
      severity: "error",
      comment: "cf-api must not import cf-commerce code directly — communicate via HTTP",
      from: { path: "^apps/cf-api" },
      to: { path: "^apps/cf-commerce" },
    },
    {
      name: "no-cf-commerce-to-cf-api",
      severity: "error",
      comment: "cf-commerce must not import cf-api code directly — communicate via HTTP",
      from: { path: "^apps/cf-commerce" },
      to: { path: "^apps/cf-api" },
    },
    {
      name: "no-web-to-cf-api-src",
      severity: "error",
      comment: "web app must not import cf-api source directly — only via shared packages",
      from: { path: "^apps/web" },
      to: { path: "^apps/cf-api/src" },
    },
    {
      name: "no-web-to-cf-commerce-src",
      severity: "error",
      comment: "web app must not import cf-commerce source directly",
      from: { path: "^apps/web" },
      to: { path: "^apps/cf-commerce/src" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "No circular dependencies",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphan",
      severity: "info",
      comment: "Warn about orphaned modules (no imports and not imported)",
      from: { orphan: true, pathNot: ["^.+\\.d\\.ts$", "test-preload"] },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: [
        "node_modules",
        "\\.d\\.ts$",
        "\\.spec\\.ts$",
        "\\.test\\.ts$",
        "\\.stories\\.tsx?$",
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
      archi: {
        collapsePattern: "^(node_modules|packages)/[^/]+",
      },
    },
  },
};
