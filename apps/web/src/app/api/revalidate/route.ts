import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

interface RevalidateRequest {
  path?: string;
  tag?: string;
  secret: string;
}

interface RevalidateResponse {
  revalidated: boolean;
  message?: string | undefined;
  error?: string | undefined;
  now?: number | undefined;
}

interface BatchRevalidateRequest {
  paths?: string[];
  tags?: string[];
  secret: string;
}

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

async function validateRequest(request: NextRequest): Promise<{ valid: boolean; error?: string }> {
  if (!REVALIDATE_SECRET) {
    return { valid: false, error: "Revalidation not configured" };
  }

  if (request.method !== "POST") {
    return { valid: false, error: "Method not allowed" };
  }

  const headersList = await headers();
  const origin = headersList.get("origin");

  if (process.env.NODE_ENV === "production") {
    const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL, process.env.API_CORE_URL].filter(
      Boolean
    );

    if (origin && !allowedOrigins.some((o) => origin.startsWith(o ?? ""))) {
      console.warn("[Revalidate] Suspicious request from origin:", origin);
    }
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequest(request);
    if (!validation.valid) {
      return NextResponse.json(
        { revalidated: false, error: validation.error } satisfies RevalidateResponse,
        { status: 400 }
      );
    }

    const body: RevalidateRequest = await request.json();

    if (body.secret !== REVALIDATE_SECRET) {
      return NextResponse.json(
        { revalidated: false, error: "Invalid secret" } satisfies RevalidateResponse,
        { status: 401 }
      );
    }

    if (!(body.path || body.tag)) {
      return NextResponse.json(
        { revalidated: false, error: "Missing path or tag parameter" } satisfies RevalidateResponse,
        { status: 400 }
      );
    }

    if (body.path) {
      revalidatePath(body.path);

      console.log(`[Revalidate] Path revalidated: ${body.path}`);

      return NextResponse.json({
        revalidated: true,
        message: `Path ${body.path} revalidated`,
        now: Date.now(),
      } satisfies RevalidateResponse);
    }

    if (body.tag) {
      revalidateTag(body.tag, {});

      console.log(`[Revalidate] Tag revalidated: ${body.tag}`);

      return NextResponse.json({
        revalidated: true,
        message: `Tag ${body.tag} revalidated`,
        now: Date.now(),
      } satisfies RevalidateResponse);
    }

    return NextResponse.json(
      { revalidated: false, error: "Invalid parameters" } satisfies RevalidateResponse,
      { status: 400 }
    );
  } catch (error) {
    console.error("[Revalidate] Error:", error);

    return NextResponse.json(
      {
        revalidated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } satisfies RevalidateResponse,
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "ISR Revalidation Endpoint",
    usage: {
      method: "POST",
      body: {
        path: "/path/to/page (optional)",
        tag: "cache-tag (optional)",
        secret: "your-revalidate-secret (required)",
      },
      examples: [
        {
          description: "Revalidate products page",
          body: { path: "/products", secret: "..." },
        },
        {
          description: "Revalidate by tag",
          body: { tag: "products", secret: "..." },
        },
      ],
    },
    configuration: {
      setRevalidateSecret: "Add REVALIDATE_SECRET to your .env file",
    },
  });
}

export async function PUT(request: NextRequest) {
  try {
    const validation = await validateRequest(request);
    if (!validation.valid) {
      return NextResponse.json(
        { revalidated: false, error: validation.error } satisfies RevalidateResponse,
        { status: 400 }
      );
    }

    const body: BatchRevalidateRequest = await request.json();

    if (body.secret !== REVALIDATE_SECRET) {
      return NextResponse.json(
        { revalidated: false, error: "Invalid secret" } satisfies RevalidateResponse,
        { status: 401 }
      );
    }

    const results = {
      paths: [] as string[],
      tags: [] as string[],
    };

    if (body.paths && Array.isArray(body.paths)) {
      for (const path of body.paths) {
        revalidatePath(path);
        results.paths.push(path);
      }
    }

    if (body.tags && Array.isArray(body.tags)) {
      for (const tag of body.tags) {
        revalidateTag(tag, {});
        results.tags.push(tag);
      }
    }

    return NextResponse.json({
      revalidated: true,
      message: `Revalidated ${results.paths.length} paths, ${results.tags.length} tags`,
      now: Date.now(),
    } satisfies RevalidateResponse);
  } catch (error) {
    console.error("[Revalidate] Batch error:", error);

    return NextResponse.json(
      {
        revalidated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } satisfies RevalidateResponse,
      { status: 500 }
    );
  }
}
