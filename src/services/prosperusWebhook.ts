// ─── Prosperus Webhook Service ──────────────────────────────────────────────
// Sends generated HTML reports to the Prosperus Club app API via webhook.
// Sequential delivery to avoid rate limiting. No retry — failures are logged.

export interface WebhookResult {
  ok: boolean;
  status: number;
  message?: string;
}

export interface SendAllResult {
  sent: number;
  failed: Array<{ email: string; error: string }>;
}

/**
 * Sends a single HTML report to the Prosperus API.
 * Never throws — returns a typed result with ok/status/message.
 */
export async function sendReportToProsperusApi(
  email: string,
  title: string,
  htmlContent: string,
  apiUrl: string,
  apiSecret: string,
): Promise<WebhookResult> {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        title,
        html_content: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { ok: false, status: response.status, message: errorText };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Sends reports to all recipients sequentially.
 * Calls onProgress after each attempt for real-time UI feedback.
 * Continues on failure — collects failed emails for review.
 */
export async function sendAllReports(
  recipients: Array<{ email: string; html: string; title: string }>,
  apiUrl: string,
  apiSecret: string,
  onProgress?: (current: number, total: number, email: string) => void,
): Promise<SendAllResult> {
  const result: SendAllResult = { sent: 0, failed: [] };

  for (let i = 0; i < recipients.length; i++) {
    const { email, html, title } = recipients[i];
    onProgress?.(i + 1, recipients.length, email);

    const res = await sendReportToProsperusApi(email, title, html, apiUrl, apiSecret);

    if (res.ok) {
      result.sent++;
    } else {
      result.failed.push({ email, error: `${res.status} ${res.message ?? ''}`.trim() });
    }
  }

  return result;
}
