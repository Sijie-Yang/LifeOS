/**
 * Lightweight email sender for LifeOS deadline digests.
 * Uses Resend HTTP API when RESEND_API_KEY is set.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  | { ok: true; id?: string; dryRun?: boolean }
  | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "LifeOS <onboarding@resend.dev>";

  if (process.env.EMAIL_DRY_RUN === "1") return { ok: true, dryRun: true };

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[email:dry-run]", { to: input.to, subject: input.subject });
      return { ok: true, dryRun: true };
    }
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: data.message || `Resend HTTP ${res.status}` };
  }
  return { ok: true, id: data.id };
}
