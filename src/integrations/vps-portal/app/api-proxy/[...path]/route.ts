import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildTargetUrl(request: NextRequest, path: string[]) {
  const targetBase = (process.env.API_PROXY_TARGET ?? "http://localhost:8080").replace(
    /\/+$/,
    "",
  );
  const upstreamUrl = new URL(`${targetBase}/api/${path.join("/vps")}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  return upstreamUrl;
}

async function proxyRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await context.params;
  const targetUrl = buildTargetUrl(request, path);
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: {
      Accept: request.headers.get("accept") ?? "application/json",
      Authorization: request.headers.get("authorization") ?? "",
      "Content-Type": request.headers.get("content-type") ?? "",
    },
    body,
    cache: "no-store",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: {
      "Content-Type":
        upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}
