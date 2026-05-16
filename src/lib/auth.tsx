import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AccountStatus = "pending" | "approved" | "rejected" | "blocked";
export type AppRole = "admin" | "employee";

const PRIMARY_ADMIN_EMAIL = "mace11200411@gmail.com";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  status: AccountStatus | null;
  role: AppRole | null;
  isAdmin: boolean;
  isApproved: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const isPrimaryAdmin = (email?: string | null) => email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

  const ensureMissingProfile = async (currentUser: User) => {
    const fallbackName = currentUser.user_metadata?.display_name
      ?? currentUser.user_metadata?.name
      ?? currentUser.email?.split("@")[0]
      ?? "Utilizador";

    const { error } = await supabase.from("profiles").upsert({
      id: currentUser.id,
      email: currentUser.email ?? null,
      display_name: fallbackName,
      name: fallbackName,
      status: isPrimaryAdmin(currentUser.email) ? "approved" : "pending",
    }, { onConflict: "id" });

    if (error) throw error;
  };

  const loadProfile = async (currentUser: User) => {
    setLoading(true);

    try {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("status").eq("id", currentUser.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
      ]);

      let profile = prof as { status?: AccountStatus } | null;

      if (!profile) {
        await ensureMissingProfile(currentUser);
        const { data: ensuredProfile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", currentUser.id)
          .maybeSingle();

        profile = ensuredProfile as { status?: AccountStatus } | null;
      }

      const resolvedRoles = (roles ?? []) as { role: AppRole }[];
      const primaryAdmin = isPrimaryAdmin(currentUser.email);

      setStatus((profile?.status ?? (primaryAdmin ? "approved" : null)) as AccountStatus | null);
      setRole(
        resolvedRoles.some((entry) => entry.role === "admin")
          ? "admin"
          : primaryAdmin
            ? "admin"
            : resolvedRoles[0]?.role ?? "employee",
      );
    } catch (error) {
      console.error("Failed to load account profile", error);
      setStatus(isPrimaryAdmin(currentUser.email) ? "approved" : null);
      setRole(isPrimaryAdmin(currentUser.email) ? "admin" : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncSession = async (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        await loadProfile(s.user);
      } else {
        setStatus(null);
        setRole(null);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      void syncSession(s);
    });

    void supabase.auth.getSession().then(({ data: { session: s } }) => syncSession(s));

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStatus(null);
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const refreshProfile = async () => { if (user) await loadProfile(user.id); };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        status,
        role,
        isAdmin: role === "admin",
        isApproved: status === "approved",
        refreshProfile,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
