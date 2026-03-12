import { NextResponse } from "next/server";
import postgres from "postgres";
import { createClient } from "redis";

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: { status: "healthy" | "unhealthy"; latency: number; message?: string };
    cache: { status: "healthy" | "unhealthy" | "skipped"; latency: number; message?: string };
    api: { status: "healthy" | "unhealthy"; latency: number; message?: string };
  };
}

const startTime = Date.now();

const isRedisEnabled = process.env.REDIS_URL !== undefined;
const isDatabaseEnabled = process.env.DATABASE_URL !== undefined;

async function checkDatabase(): Promise<HealthStatus["checks"]["database"]> {
  if (!isDatabaseEnabled) {
    return { status: "healthy", latency: 0, message: "Database check skipped (no DATABASE_URL)" };
  }

  const start = Date.now();

  try {
    const client = postgres(process.env.DATABASE_URL ?? "", {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
    });

    await client`SELECT 1`;
    await client.end();

    return { status: "healthy", latency: Date.now() - start };
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

async function checkCache(): Promise<HealthStatus["checks"]["cache"]> {
  if (!(isRedisEnabled && process.env.REDIS_URL)) {
    return { status: "skipped", latency: 0, message: "Redis check skipped (no REDIS_URL)" };
  }

  const start = Date.now();
  const client = createClient({ url: process.env.REDIS_URL });

  try {
    await client.connect();
    await client.ping();
    await client.disconnect();

    return { status: "healthy", latency: Date.now() - start };
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Redis connection failed",
    };
  }
}

async function checkApiCore(): Promise<HealthStatus["checks"]["api"]> {
  const apiUrl = process.env.API_CORE_URL ?? process.env.NEXT_PUBLIC_API_CORE_URL;

  if (!apiUrl) {
    return { status: "healthy", latency: 0, message: "API check skipped (no API_CORE_URL)" };
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${apiUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { status: "healthy", latency: Date.now() - start };
    }
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: `API returned ${response.status}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "API connection failed",
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deep = searchParams.get("deep") === "true";

  if (!deep) {
    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
      },
      { status: 200 }
    );
  }

  const [database, cache, api] = await Promise.all([checkDatabase(), checkCache(), checkApiCore()]);

  let status: HealthStatus["status"] = "healthy";

  if (database.status === "unhealthy" || api.status === "unhealthy") {
    status = "unhealthy";
  } else if (cache.status === "unhealthy") {
    status = "degraded";
  }

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "2.0.0",
    uptime: Date.now() - startTime,
    checks: { database, cache, api },
  };

  return NextResponse.json(health, {
    status: status === "healthy" ? 200 : status === "degraded" ? 200 : 503,
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
