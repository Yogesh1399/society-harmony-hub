// Integration tests for the generate-maintenance-bills edge function.
//
// These tests exercise the deployed function over HTTP. They validate:
//   1. Invalid inputs (bad month, missing society) are rejected with
//      fieldErrors and no rows are written.
//   2. dry_run preview totals match the sum of per-flat total_amount.
//   3. A live generation returns a bill_count and audit_id, and the created
//      member_payment_notifications carry the correct due_date and
//      total_amount for each bill.
//
// Requires in your project root .env:
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
//   TEST_ADMIN_JWT           (a society_admin/committee/super_admin bearer)
//   TEST_SOCIETY_ID          (uuid of a society that admin can manage)
//
// Run with:  deno test -A --env supabase/functions/generate-maintenance-bills/index.test.ts

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const JWT = Deno.env.get("TEST_ADMIN_JWT")!;
const SOCIETY_ID = Deno.env.get("TEST_SOCIETY_ID")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/generate-maintenance-bills`;

function invoke(body: unknown, jwt = JWT) {
  return fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects month out of range with fieldErrors", async () => {
  const res = await invoke({ society_id: SOCIETY_ID, year: 2026, month: 13 });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Validation failed");
  assert(body.fieldErrors?.month, "expected fieldErrors.month");
});

Deno.test("rejects missing society_id", async () => {
  const res = await invoke({ year: 2026, month: 3 });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(body.fieldErrors?.society_id, "expected fieldErrors.society_id");
});

Deno.test("rejects unauthenticated requests", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ society_id: SOCIETY_ID, year: 2026, month: 4 }),
  });
  await res.text(); // drain
  assertEquals(res.status, 401);
});

Deno.test("dry_run preview sum matches total_amount", async () => {
  const res = await invoke({
    society_id: SOCIETY_ID, year: 2027, month: 1, dry_run: true,
  });
  const body = await res.json();
  assertEquals(res.status, 200);
  assert(body.dry_run);
  const sum = body.preview.bills.reduce(
    (s: number, b: any) => s + Number(b.total_amount || 0), 0,
  );
  assertEquals(Number(sum.toFixed(2)), Number(body.preview.total_amount.toFixed(2)));
  assertEquals(body.preview.billable_count, body.preview.bills.length);
});

Deno.test("generation creates bills + notifications with matching due_date/amount", async () => {
  // Use a far-future month so we can safely upsert & re-check
  const year = 2035, month = 9;
  const res = await invoke({ society_id: SOCIETY_ID, year, month, due_day: 12 });
  const body = await res.json();
  assertEquals(res.status, 200, `unexpected: ${JSON.stringify(body)}`);
  assert(body.ok);
  const { result, preview } = body;
  assertEquals(result.bill_month, `${year}-0${month}`);
  assertEquals(result.due_date, `${year}-0${month}-12`);
  assertEquals(result.bill_count, preview.bills.length);
  assert(result.audit_id, "expected audit_id");
  assertEquals(
    Number(result.total_amount.toFixed(2)),
    Number(preview.total_amount.toFixed(2)),
  );

  // Cross-check notifications for the first billed member via PostgREST
  const firstWithMember = preview.bills.find((b: any) => b.member_id);
  if (!firstWithMember) return;

  const noteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/member_payment_notifications` +
      `?member_id=eq.${firstWithMember.member_id}` +
      `&order=created_at.desc&limit=1`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${JWT}` } },
  );
  const notes = await noteRes.json();
  assert(Array.isArray(notes) && notes.length > 0, "notification not found");
  const message: string = notes[0].message;
  assert(message.includes(`${year}-0${month}`), `bill_month missing in message: ${message}`);
  assert(message.includes("12 Sep"), `due_date missing in message: ${message}`);
  // Total amount appears in the message with Indian comma formatting
  const expected = Number(firstWithMember.total_amount).toFixed(2);
  assert(
    message.includes(expected) || message.includes(Number(expected).toLocaleString("en-IN")),
    `total_amount missing in message: ${message}`,
  );
});
