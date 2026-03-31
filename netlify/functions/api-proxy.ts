import type { Handler, HandlerEvent } from "@netlify/functions";

// ─── Configuration ──────────────────────────────────────────────────────────

const SERVICE_URLS: Record<string, string> = {
  members: "https://prof.curseduca.pro",
  contents: "https://clas.curseduca.pro",
};

const ALLOWED_ENDPOINTS = [
  "/members",
  "/groups",
  "/reports/access",
  "/reports/progress",
  "/api/reports/enrollments",
  "/api/reports/contents",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function isEndpointAllowed(endpoint: string): boolean {
  if (ALLOWED_ENDPOINTS.includes(endpoint)) return true;
  // Dynamic pattern: /groups/{id}/members
  if (/^\/groups\/\d+\/members$/.test(endpoint)) return true;
  return false;
}

function getCorsHeaders(): Record<string, string> {
  // process.env.URL is set by Netlify to the site URL
  // In netlify dev: http://localhost:8888
  // In production: https://your-site.netlify.app
  const origin = process.env.URL || "http://localhost:8888";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────

const handler: Handler = async (event: HandlerEvent) => {
  const corsHeaders = getCorsHeaders();

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // AC6: Only POST allowed
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // AC2: Credentials from env only
  const apiKey = process.env.CURSEDUCA_API_KEY;
  const accessToken = process.env.ACCESS_TOKEN;
  if (!apiKey || !accessToken) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "API credentials not configured" }),
    };
  }

  // Parse request body
  let body: { service?: string; endpoint?: string; params?: Record<string, string | number> };
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { service, endpoint, params } = body;

  // AC5: Validate service
  if (!service || !(service in SERVICE_URLS)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid service. Must be 'members' or 'contents'" }),
    };
  }

  // Validate endpoint presence
  if (!endpoint) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing endpoint" }),
    };
  }

  // AC7: Validate against allowlist
  if (!isEndpointAllowed(endpoint)) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Endpoint not allowed" }),
    };
  }

  // Build target URL
  const baseUrl = SERVICE_URLS[service];
  const queryString = params
    ? "?" + new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString()
    : "";
  const url = `${baseUrl}${endpoint}${queryString}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        api_key: apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: data,
    };
  } catch (error) {
    console.error("Error proxying to CursoEduca API:", error);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `Failed to reach CursoEduca API: ${error instanceof Error ? error.message : "Unknown error"}`,
      }),
    };
  }
};

export { handler };
