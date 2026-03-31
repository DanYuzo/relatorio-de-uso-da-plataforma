import type { Handler, HandlerEvent } from "@netlify/functions";
import { google } from "googleapis";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCorsHeaders(): Record<string, string> {
  const origin = process.env.URL || "http://localhost:8888";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:Z", // Dynamic range — reads all columns present in the spreadsheet
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
