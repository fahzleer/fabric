import { type Result, isOk, tryCatchAsync } from "@fabric/types";

export interface Env {
  CF_API_URL: string;
  CF_COMMERCE_URL: string;
  FIREBASE_HOSTING_URL: string;
}

const API_PATTERN = new URLPattern({ pathname: "/(api|auth|token)/*" });

const COMMERCE_PATTERN = new URLPattern({
  pathname: "/(checkout|pricing|inventory|voucher|events|sse|payment)/*",
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, search } = new URL(request.url);

    let targetBase: string;

    if (API_PATTERN.test({ pathname })) {
      targetBase = env.CF_API_URL;
    } else if (COMMERCE_PATTERN.test({ pathname })) {
      targetBase = env.CF_COMMERCE_URL;
    } else {
      targetBase = env.FIREBASE_HOSTING_URL;
    }

    const hasBody = !["GET", "HEAD"].includes(request.method);

    const upstreamRequest = new Request(`${targetBase}${pathname}${search}`, {
      method: request.method,
      headers: addForwardedHeaders(request),
      ...(hasBody && { body: request.body }),
      redirect: "follow",
    });

    const result: Result<Response, unknown> = await tryCatchAsync(() => fetch(upstreamRequest));

    if (isOk(result)) {
      const response = result.value;
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      responseHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
      responseHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    console.error(`[worker] upstream error: ${String(result.error)}`);
    return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  },
};

function addForwardedHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);

  const clientIp =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  headers.set("x-forwarded-for", clientIp);
  headers.set("x-real-ip", clientIp);

  const country = request.headers.get("cf-ipcountry");
  if (country) {
    headers.set("x-cf-country", country);
  }

  return headers;
}
