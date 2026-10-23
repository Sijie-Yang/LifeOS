import assert from "node:assert/strict";
import { test } from "node:test";
import { sendEmail } from "./email";

test("EMAIL_DRY_RUN prevents network delivery even when an API key is configured", async (t) => {
  const oldKey = process.env.RESEND_API_KEY;
  const oldDryRun = process.env.EMAIL_DRY_RUN;
  try {
    process.env.RESEND_API_KEY = "test-only-placeholder";
    process.env.EMAIL_DRY_RUN = "1";
    const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not send"); });
    assert.deepEqual(await sendEmail({ to: "hello@example.com", subject: "Test", html: "Test" }), { ok: true, dryRun: true });
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
    if (oldDryRun === undefined) delete process.env.EMAIL_DRY_RUN; else process.env.EMAIL_DRY_RUN = oldDryRun;
  }
});
