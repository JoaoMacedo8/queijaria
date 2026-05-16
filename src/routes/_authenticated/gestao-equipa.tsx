import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Check, X, Trash2, UserCog, Clock, Users as UsersIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AccountStatus, type AppRole } from "@/lib/auth";
import { listAllTeamUsers, type TeamUserRecord } from "@/lib/team.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao-equipa")({
  component: GestaoEquipaPage,
});

type TeamMember = TeamUserRecord;
type ExtendedStatus = AccountStatus | "removed";

const statusLabels: Record<ExtendedStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  blocked: "Bloqueado",
  removed: "Removido",
};

const statusStyles: Record<ExtendedStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
  blocked: "bg-zinc-200 text-zinc-800 border-zinc-300",
  removed: "bg-stone-200 text-stone-700 border-stone-300",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  } catch { return "—"; }
}

function GestaoEquipaPage() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const fetchTeam = useServerFn(listAllTeamUsers);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetchTeam({ data: {} });
      setMembers(res.users as TeamMember[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar utilizadores");
    } finally {
      setFetching(false);
    }
  }, [fetchTeam]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const updateStatus = async (id: string, status: AccountStatus) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Utilizador ${statusLabels[status].toLowerCase()}`);
    load();
  };

  const toggleAdmin = async (id: string, makeAdmin: boolean) => {
    setBusy(id);
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
      if (error && !error.message.includes("duplicate")) { setBusy(null); return toast.error(error.message); }
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
      if (error) { setBusy(null); return toast.error(error.message); }
    }
    setBusy(null);
    toast.success("Cargo atualizado");
    load();
  };

  const removeUser = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Utilizador removido");
    load();
  };

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "approved");
  const rejected = members.filter((m) => m.status === "rejected" || m.status === "blocked");
  const removed = members.filter((m) => m.status === "removed");

  const Row = ({ m }: { m: TeamMember }) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card/60 hover:bg-card transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-accent/30 flex items-center justify-center text-accent-foreground font-medium">
          {(m.name || m.display_name || m.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-primary truncate">{m.name || m.display_name || "Sem nome"}</div>
          <div className="text-xs text-muted-foreground truncate">{m.email}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Registo: {new Date(m.created_at).toLocaleDateString("pt-PT")}</span>
            <span>Último login: {formatDateTime(m.last_sign_in_at)}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={statusStyles[m.status]}>{statusLabels[m.status]}</Badge>
        <Badge variant="outline" className={m.role === "admin" ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground"}>
          {m.role === "admin" ? "Admin" : "Funcionário"}
        </Badge>

        {m.status === "pending" && (
          <>
            <Button size="sm" disabled={busy === m.id} onClick={() => updateStatus(m.id, "approved")} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => updateStatus(m.id, "rejected")}>
              <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
            </Button>
          </>
        )}

        {m.status === "approved" && (
          <>
            <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => toggleAdmin(m.id, m.role !== "admin")}>
              <UserCog className="h-3.5 w-3.5 mr-1" />
              {m.role === "admin" ? "Remover admin" : "Tornar admin"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => updateStatus(m.id, "blocked")}>
              Bloquear
            </Button>
          </>
        )}

        {(m.status === "blocked" || m.status === "rejected") && (
          <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => updateStatus(m.id, "approved")}>
            <Check className="h-3.5 w-3.5 mr-1" /> Reativar
          </Button>
        )}

        {m.status !== "removed" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-rose-700 hover:text-rose-800 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover utilizador?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove o perfil de <strong>{m.email}</strong>. A conta de autenticação subjacente permanece, mas o utilizador perde acesso à aplicação.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => removeUser(m.id)} className="bg-rose-700 hover:bg-rose-800">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        )}
      </div>
    </motion.div>
  );

  if (loading || !isAdmin) {
    return <div className="text-muted-foreground">A carregar…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-accent/30 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-accent-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-primary">Gestão de Equipa</h1>
          <p className="text-sm text-muted-foreground italic">Aprovar e gerir os utilizadores da aplicação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-700" />
          <div><div className="text-2xl font-display text-primary">{pending.length}</div><div className="text-xs text-muted-foreground">Pendentes</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <UsersIcon className="h-5 w-5 text-emerald-700" />
          <div><div className="text-2xl font-display text-primary">{active.length}</div><div className="text-xs text-muted-foreground">Ativos</div></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div><div className="text-2xl font-display text-primary">{active.filter((m) => m.role === "admin").length}</div><div className="text-xs text-muted-foreground">Administradores</div></div>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="active">Aprovados ({active.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({rejected.length})</TabsTrigger>
          <TabsTrigger value="removed">Removidos ({removed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {fetching ? <div className="text-muted-foreground text-sm">A carregar…</div> :
            pending.length === 0 ? <div className="text-muted-foreground text-sm italic">Sem utilizadores pendentes.</div> :
            pending.map((m) => <Row key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="active" className="space-y-3 mt-4">
          {active.length === 0 ? <div className="text-muted-foreground text-sm italic">Sem utilizadores aprovados.</div> :
            active.map((m) => <Row key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-3 mt-4">
          {rejected.length === 0 ? <div className="text-muted-foreground text-sm italic">Sem registos.</div> :
            rejected.map((m) => <Row key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="removed" className="space-y-3 mt-4">
          {removed.length === 0 ? <div className="text-muted-foreground text-sm italic">Sem utilizadores removidos.</div> :
            removed.map((m) => <Row key={m.id} m={m} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
