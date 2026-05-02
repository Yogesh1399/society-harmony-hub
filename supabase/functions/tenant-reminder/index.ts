import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find all unverified active tenants
    const { data: unverifiedTenants, error } = await adminClient
      .from("tenants")
      .select("id, full_name, flat_id, society_id, validity_from, validity_to, created_at, flats(flat_number, wing), members:flats(members(full_name, user_id))")
      .is("verified_at", null)
      .eq("is_active", true);

    if (error) throw error;

    const now = new Date();
    const notifications: any[] = [];

    for (const tenant of unverifiedTenants || []) {
      const createdAt = new Date(tenant.created_at);
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Daily notification to owner & tenant
      const flatInfo = tenant.flats as any;
      const flatLabel = flatInfo ? `${flatInfo.wing ? flatInfo.wing + '-' : ''}${flatInfo.flat_number}` : 'Unknown';

      notifications.push({
        society_id: tenant.society_id,
        title: "⚠️ Unverified Tenant Agreement",
        message: `Tenant ${tenant.full_name} (Flat ${flatLabel}) agreement is not yet verified. Please submit the agreement for verification.`,
        type: "reminder",
        source_type: "tenant",
        source_id: tenant.id,
      });

      // Weekly notification to society body (every 7 days)
      if (daysSinceCreation % 7 === 0) {
        notifications.push({
          society_id: tenant.society_id,
          title: "📋 Weekly: Unverified Tenant Report",
          message: `Tenant ${tenant.full_name} (Flat ${flatLabel}) has been unverified for ${daysSinceCreation} days. Agreement verification is pending.`,
          type: "reminder",
          source_type: "tenant",
          source_id: tenant.id,
          target_roles: ["society_admin", "committee_member"],
        });
      }
    }

    // Batch insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await adminClient
        .from("notifications")
        .insert(notifications);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${unverifiedTenants?.length || 0} unverified tenants, created ${notifications.length} notifications` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
