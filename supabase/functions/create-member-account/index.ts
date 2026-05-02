import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Only super_admin or society_admin can create member accounts
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = callerRoles?.some(r =>
      r.role === "super_admin" || r.role === "society_admin"
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { member_id, flat_number, society_id, full_name, email, mobile } = await req.json();

    if (!member_id || !society_id || !full_name) {
      return new Response(JSON.stringify({ error: "member_id, society_id, and full_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email: use provided email, or derive from mobile, or from flat number
    let memberEmail: string;
    if (email && email.trim() !== '') {
      memberEmail = email.trim().toLowerCase();
    } else if (mobile && mobile.trim() !== '') {
      memberEmail = `member.${mobile.trim()}@society.local`;
    } else if (flat_number) {
      memberEmail = `flat.${flat_number.toLowerCase().replace(/\s+/g, '')}@society.local`;
    } else {
      memberEmail = `member.${member_id.slice(0, 8)}@society.local`;
    }

    const defaultPassword = "Society@123";

    // Check if auth user already exists
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.find(
      u => u.email?.toLowerCase() === memberEmail.toLowerCase()
    );

    let userId: string;
    let isNew = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create auth user with auto-confirm (no email verification needed)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: memberEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name,
          flat_number: flat_number || '',
        },
      });
      if (createError) throw createError;
      userId = newUser.user.id;
      isNew = true;

      // Create profile record
      await adminClient.from("profiles").upsert({
        id: userId,
        email: memberEmail,
        full_name: full_name,
        mobile: mobile || null,
        is_active: true,
      });
    }

    // Link user_id to member record
    await adminClient
      .from("members")
      .update({ user_id: userId })
      .eq("id", member_id);

    // Assign flat_owner role if not already assigned
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("society_id", society_id)
      .eq("role", "flat_owner")
      .maybeSingle();

    if (!existingRole) {
      await adminClient.from("user_roles").insert({
        user_id: userId,
        society_id: society_id,
        role: "flat_owner",
      });
    }

    return new Response(
      JSON.stringify({
        message: isNew ? "Login account created successfully" : "Existing account linked",
        user_id: userId,
        email: memberEmail,
        default_password: isNew ? defaultPassword : undefined,
        is_new: isNew,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("create-member-account error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
