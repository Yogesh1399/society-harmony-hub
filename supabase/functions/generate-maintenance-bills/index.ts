// Server-side maintenance bill generation.
//
// - Validates the caller's JWT and society_admin/committee role.
// - Fetches settings, active heads, flats+members from the DB (source of truth).
// - Recomputes every flat's amount server-side (client input is only month/year).
// - Calls generate_maintenance_bills_tx RPC → atomic bills + items + ledger +
//   notifications + audit_log in a single transaction.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RENTED = new Set(["rented", "available_for_tenant", "tenant_occupied"]);
const ADMIN_ROLES = new Set(["super_admin", "society_admin", "committee_member"]);

type Head = { id: string; head_name: string; amount: number | string; is_active?: boolean };
type Member = { id: string; maintenance_amount?: number | string; extra_maintenance?: number | string };
type Flat = { id: string; status?: string; area_sqft?: number | string; members?: Member[] };

interface Body {
  society_id?: string;
  year?: number;
  month?: number;   // 1-12
  due_day?: number; // optional override; else settings.due_day, else 10
  dry_run?: boolean;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateInput(input: Body, maxYear: number) {
  const errs: Record<string, string> = {};
  const year = Number(input.year);
  const month = Number(input.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) errs.month = "Month must be 1–12";
  if (!Number.isInteger(year) || year < 2000 || year > maxYear) {
    errs.year = `Year must be between 2000 and ${maxYear}`;
  }
  if (!input.society_id || typeof input.society_id !== "string") errs.society_id = "society_id is required";
  if (Object.keys(errs).length) return { ok: false as const, errors: errs };

  const dueDay = Math.min(Math.max(Number(input.due_day || 10) || 10, 1), 28);
  const billMonth = `${year}-${String(month).padStart(2, "0")}`;
  const due = new Date(Date.UTC(year, month - 1, dueDay));
  return {
    ok: true as const,
    society_id: input.society_id!,
    year, month, dueDay, billMonth,
    dueDate: due.toISOString().split("T")[0],
  };
}

function computeFlatAmount(flat: Flat, settings: any, activeHeads: Head[]): number {
  const basis: string = settings?.calculation_basis || "flat_rate";
  const ownerAmt = Number(settings?.owner_occupied_amount || 0);
  const rentedAmt = Number(settings?.rented_flat_amount || 0);
  const perSqft = Number(settings?.per_sqft_rate || 0);
  const headTotal = activeHeads.reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const member = flat.members?.[0];
  const extra = Number(member?.extra_maintenance || 0);
  const flatType = RENTED.has(flat.status || "") ? rentedAmt : ownerAmt;
  const sqftAmt = Number(flat.area_sqft || 0) * perSqft;
  let base = 0;
  switch (basis) {
    case "flat_type":   base = flatType; break;
    case "per_sqft":    base = sqftAmt; break;
    case "combo":       base = flatType + sqftAmt; break;
    case "member_wise": base = Number(member?.maintenance_amount || 0); break;
    default:            base = headTotal;
  }
  return Number((base + extra).toFixed(2));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: authError } = await userClient.auth.getUser();
  if (authError || !userRes?.user) return json(401, { error: "Unauthorized" });
  const userId = userRes.user.id;

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Invalid JSON body" }); }

  const validation = validateInput(body, new Date().getUTCFullYear() + 1);
  if (!validation.ok) return json(400, { error: "Validation failed", fieldErrors: validation.errors });

  const admin = createClient(supabaseUrl, serviceKey);

  // Authorize: must have an admin role for this society (or be super_admin)
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role, society_id")
    .eq("user_id", userId);
  if (rolesErr) return json(500, { error: rolesErr.message });
  const allowed = (roles || []).some((r: any) =>
    ADMIN_ROLES.has(r.role) &&
    (r.role === "super_admin" || r.society_id === validation.society_id)
  );
  if (!allowed) return json(403, { error: "Forbidden — society admin role required" });

  // Load settings, heads, flats+members
  const [{ data: settings }, { data: heads, error: headsErr }, { data: flats, error: flatsErr }] =
    await Promise.all([
      admin.from("maintenance_settings").select("*").eq("society_id", validation.society_id).maybeSingle(),
      admin.from("maintenance_heads").select("*").eq("society_id", validation.society_id),
      admin.from("flats").select("*, members(id, full_name, maintenance_amount, extra_maintenance)")
        .eq("society_id", validation.society_id),
    ]);
  if (headsErr) return json(500, { error: headsErr.message });
  if (flatsErr) return json(500, { error: flatsErr.message });

  const activeHeads: Head[] = (heads || []).filter((h: any) => h.is_active);
  const basis: string = (settings as any)?.calculation_basis || "flat_rate";

  if (basis === "flat_rate" && activeHeads.length === 0) {
    return json(400, { error: "No active maintenance heads — add at least one head or change calculation basis" });
  }

  const preview = (flats || [])
    .filter((f: any) => f.status !== "vacant")
    .map((flat: any) => {
      const amount = computeFlatAmount(flat, settings, activeHeads);
      const items = basis === "flat_rate"
        ? activeHeads.map((h) => ({ head_id: h.id, head_name: h.head_name, amount: Number(h.amount) || 0 }))
        : [{ head_id: null, head_name: `Maintenance (${basis.replace("_", " ")})`, amount }];
      return {
        flat_id: flat.id,
        flat_number: flat.flat_number,
        wing: flat.wing,
        member_id: flat.members?.[0]?.id ?? null,
        member_name: flat.members?.[0]?.full_name ?? null,
        total_amount: amount,
        items,
      };
    });

  const billable = preview.filter((p) => p.total_amount > 0);
  const previewTotal = billable.reduce((s, p) => s + p.total_amount, 0);

  if (billable.length === 0) {
    return json(400, { error: "No billable flats — check maintenance settings, heads, or flat statuses" });
  }

  const responsePreview = {
    bill_month: validation.billMonth,
    due_date: validation.dueDate,
    basis,
    flat_count: preview.length,
    billable_count: billable.length,
    total_amount: Number(previewTotal.toFixed(2)),
    bills: billable,
  };

  if (body.dry_run) return json(200, { dry_run: true, preview: responsePreview });

  const { data: rpcResult, error: rpcErr } = await admin.rpc("generate_maintenance_bills_tx", {
    p_society_id: validation.society_id,
    p_actor_id: userId,
    p_bill_month: validation.billMonth,
    p_due_date: validation.dueDate,
    p_basis: basis,
    p_bills: billable,
  });
  if (rpcErr) return json(500, { error: rpcErr.message, code: rpcErr.code });

  return json(200, { ok: true, result: rpcResult, preview: responsePreview });
});
