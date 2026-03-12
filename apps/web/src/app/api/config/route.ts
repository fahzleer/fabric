import { NextResponse } from "next/server";

interface RuntimeConfig {
  app: {
    name: string;
    url: string;
    environment: string;
    version: string;
  };
  api: {
    core: {
      url: string;
      timeout: number;
    };
  };
  features: {
    analytics: boolean;
    sentry: boolean;
    maintenance: boolean;
  };
  limits: {
    maxUploadSize: number;
    pagination: {
      defaultPageSize: number;
      maxPageSize: number;
    };
  };
}

function getRuntimeConfig(): RuntimeConfig {
  return {
    app: {
      name: "Fabric",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      environment: process.env.NODE_ENV ?? "development",
      version: process.env.npm_package_version ?? "2.0.0",
    },
    api: {
      core: {
        url: process.env.NEXT_PUBLIC_API_CORE_URL ?? "http://localhost:3010",
        timeout: 30000,
      },
    },
    features: {
      analytics: process.env.ENABLE_ANALYTICS === "true",
      sentry: process.env.ENABLE_SENTRY === "true",
      maintenance: process.env.MAINTENANCE_MODE === "true",
    },
    limits: {
      maxUploadSize: Number.parseInt(process.env.MAX_UPLOAD_SIZE ?? "10485760", 10),
      pagination: {
        defaultPageSize: 20,
        maxPageSize: 100,
      },
    },
  };
}

export async function GET() {
  const config = getRuntimeConfig();

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}

export type { RuntimeConfig };
