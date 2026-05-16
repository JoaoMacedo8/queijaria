import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TeamUserRecord = {
  id: string;
  email: string | null;
  name: string | null;
  display_name: string | null;
  status: "pending" | "approved" | "rejected" | "blocked" | "removed";
  role: "admin" | "employee";
  created_at: string;
  last_sign_in_at: string | null;
};

export const listAllTeamUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin via RLS-aware client
    const { data: roleRows, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden");

    // Fetch all auth users (paginated)
    type AuthUserLite = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null };
    const authUsers: AuthUserLite[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        authUsers.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < perPage) break;
      page += 1;
    }

    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, display_name, name, status, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const profMap = new Map<string, NonNullable<typeof profs>[number]>();
    for (const p of profs ?? []) profMap.set(p.id, p);

    const roleMap = new Map<string, "admin" | "employee">();
    for (const r of (roles ?? []) as { user_id: string; role: "admin" | "employee" }[]) {
      const prev = roleMap.get(r.user_id);
      if (prev !== "admin") roleMap.set(r.user_id, r.role);
    }

    const result: TeamUserRecord[] = authUsers.map((u) => {
      const p = profMap.get(u.id);
      return {
        id: u.id,
        email: p?.email ?? u.email,
        name: p?.name ?? null,
        display_name: p?.display_name ?? null,
        status: (p?.status as TeamUserRecord["status"]) ?? "removed",
        role: roleMap.get(u.id) ?? "employee",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    result.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return { users: result };
  });