import type { Handler, HandlerEvent } from "@netlify/functions";
import { google, sheets_v4 } from "googleapis";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCorsHeaders(): Record<string, string> {
  const origin = process.env.URL || "http://localhost:8888";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

// Pin the read to a specific tab by gid (from the sheet URL). Falls back to the
// first visible tab when GOOGLE_SHEET_GID is unset, preserving legacy behavior.
async function resolveReferenceRange(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<string> {
  const gid = process.env.GOOGLE_SHEET_GID?.trim();
  if (!gid) return "A:Z";

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const title = (meta.data.sheets ?? []).find(
    (s) => String(s.properties?.sheetId) === gid,
  )?.properties?.title;
  if (!title) {
    throw new Error(`Sheet tab with gid ${gid} not found in spreadsheet`);
  }
  return `'${title.replace(/'/g, "''")}'!A:Z`;
}

// ─── Handler ────────────────────────────────────────────────────────────────

const handler: Handler = async (event: HandlerEvent) => {
  const corsHeaders = getCorsHeaders();

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // AC1: Only GET allowed
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // AC3/AC4: Credentials from env only
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentialsJson || !sheetId) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Google Sheets credentials not configured" }),
    };
  }

  try {
    // AC3: Parse service account credentials
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    // AC2: Read spreadsheet data via Google Sheets API v4
    const sheets = google.sheets({ version: "v4", auth });
    const range = await resolveReferenceRange(sheets, sheetId);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range, // '<tab>'!A:Z — pinned tab, all columns present
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify([]),
      };
    }

    // AC7: Map header row to object keys
    const headers = rows[0];
    const data = rows
      .slice(1)
      .map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => {
          obj[h] = row[i] || "";
        });
        return obj;
      })
      // AC8: Filter out rows without Email
      .filter((row) => row.Email?.trim());

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    // AC5: Appropriate error status codes
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("invalid_grant") || message.includes("unauthorized")) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid credentials" }),
      };
    }

    if (message.includes("not found") || message.includes("404")) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Spreadsheet not found" }),
      };
    }

    console.error("Sheets proxy error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export { handler };
