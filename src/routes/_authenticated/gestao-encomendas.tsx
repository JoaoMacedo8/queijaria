import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Phone, Calendar, Trash2, Clock, CheckCircle2, ChefHat, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao-encomendas")({
  component: GestaoEncomendasPage,
});

type EncomendaStatus = "Pendente" | "Aceite" | "Em Preparação" | "Entregue";

type Encomenda = {
  id: string;
  nome_cliente: string;
  numero_whatsapp: string;
  conteudo_pedido: string;
  valor_total: number;
  data_entrega: string | null;
  status: EncomendaStatus;
  created_at: string;
};

const STATUS_LIST: EncomendaStatus[] = ["Pendente", "Aceite", "Em Preparação", "Entregue"];

const STATUS_STYLE: Record<EncomendaStatus, string> = {
  "Pendente": "bg-amber-100/70 text-amber-900 border-amber-200",
  "Aceite": "bg-sky-100 text-sky-900 border-sky-200",
  "Em Preparação": "bg-violet-100 text-violet-900 border-violet-200",
  "Entregue": "bg-emerald-100 text-emerald-900 border-emerald-200",
};

const STATUS_ICON: Record<EncomendaStatus, typeof Clock> = {
  "Pendente": Clock,
  "Aceite": CheckCircle2,
  "Em Preparação": ChefHat,
  "Entregue": PackageCheck,
};

const FILTERS: { label: string; value: "Todos" | EncomendaStatus }[] = [
  { label: "Todos", value: "Todos" },
  { label: "Pendentes", value: "Pendente" },
  { label: "Em Preparação", value: "Em Preparação" },
  { label: "Entregues", value: "Entregue" },
];

function fmtEUR(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function fmtCreated(iso: string) {
  try { return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function GestaoEncomendasPage() {
  const [items, setItems] = useState<Encomenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"Todos" | EncomendaStatus>("Todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("encomendas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setItems((data ?? []) as Encomenda[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("encomendas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "encomendas" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "Todos") return items;
    return items.filter((e) => e.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Todos: items.length };
    STATUS_LIST.forEach((s) => { c[s] = items.filter((i) => i.status === s).length; });
    return c;
  }, [items]);

  async function changeStatus(id: string, status: EncomendaStatus) {
    const { error } = await (supabase as any).from("encomendas").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Estado: ${status}`);
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("encomendas").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Encomenda eliminada");
    setDeleteId(null);
  }

  function nextStatusButton(e: Encomenda) {
    if (e.status === "Pendente") return { label: "Aceitar", next: "Aceite" as EncomendaStatus };
    if (e.status === "Aceite") return { label: "Preparar", next: "Em Preparação" as EncomendaStatus };
    if (e.status === "Em Preparação") return { label: "Entregar", next: "Entregue" as EncomendaStatus };
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground italic tracking-wide">Tempo real • WhatsApp</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-primary mt-1">Gestão de Encomendas</h1>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-soft">
          <Plus className="h-4 w-4 mr-1.5" /> Nova Encomenda
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-3 md:p-4 shadow-soft border-border/60">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Button
                key={f.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setFilter(f.value)}
                className="h-8 rounded-full text-xs"
              >
                {f.label}
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>
                  {counts[f.value] ?? 0}
                </span>
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Cards */}
      {loading ? (
        <Card className="p-12 text-center text-muted-foreground italic">A carregar…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground italic">
          {items.length === 0 ? "Ainda não há encomendas. Cria a primeira!" : "Nenhuma encomenda neste filtro."}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {filtered.map((e) => {
              const Icon = STATUS_ICON[e.status];
              const next = nextStatusButton(e);
              return (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="p-4 flex flex-col gap-3 h-full shadow-soft border-border/60 hover:shadow-elegant transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.nome_cliente}</div>
                        <a
                          href={`https://wa.me/${e.numero_whatsapp.replace(/\D/g, "")}`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-emerald-700"
                        >
                          <Phone className="h-3 w-3" /> {e.numero_whatsapp}
                        </a>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium ${STATUS_STYLE[e.status]}`}>
                        <Icon className="h-3 w-3" /> {e.status}
                      </span>
                    </div>

                    <div className="text-sm text-foreground/80 whitespace-pre-wrap break-words line-clamp-4">
                      {e.conteudo_pedido}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {e.data_entrega || "Sem data"}
                      </span>
                      <span>{fmtCreated(e.created_at)}</span>
                    </div>

                    <div className="flex items-end justify-between pt-1 border-t border-border/50">
                      <div className="font-display text-xl text-primary">{fmtEUR(Number(e.valor_total))}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {next && (
                        <Button
                          size="sm"
                          onClick={() => changeStatus(e.id, next.next)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {next.label}
                        </Button>
                      )}
                      {STATUS_LIST.filter((s) => s !== e.status && s !== next?.next).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          onClick={() => changeStatus(e.id, s)}
                          className="h-8 text-xs"
                        >
                          {s}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(e.id)}
                        className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <NovaEncomendaDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar encomenda?</DialogTitle>
            <DialogDescription>Esta ação não pode ser revertida.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && remove(deleteId)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NovaEncomendaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome_cliente: "",
    numero_whatsapp: "",
    conteudo_pedido: "",
    valor_total: "",
    data_entrega: "",
    status: "Pendente" as EncomendaStatus,
  });

  function reset() {
    setForm({ nome_cliente: "", numero_whatsapp: "", conteudo_pedido: "", valor_total: "", data_entrega: "", status: "Pendente" });
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!form.nome_cliente.trim() || !form.numero_whatsapp.trim() || !form.conteudo_pedido.trim()) {
      toast.error("Preenche os campos obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("encomendas").insert({
      nome_cliente: form.nome_cliente.trim(),
      numero_whatsapp: form.numero_whatsapp.trim(),
      conteudo_pedido: form.conteudo_pedido.trim(),
      valor_total: Number(form.valor_total) || 0,
      data_entrega: form.data_entrega.trim() || null,
      status: form.status,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Encomenda criada");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Encomenda</DialogTitle>
          <DialogDescription>Regista uma encomenda recebida (ex: WhatsApp).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Nome do cliente *</Label>
            <Input id="nome" value={form.nome_cliente} onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wpp">Nº WhatsApp *</Label>
            <Input id="wpp" placeholder="+351 912 345 678" value={form.numero_whatsapp} onChange={(e) => setForm({ ...form, numero_whatsapp: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ped">Conteúdo do pedido *</Label>
            <Textarea id="ped" rows={4} value={form.conteudo_pedido} onChange={(e) => setForm({ ...form, conteudo_pedido: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="val">Valor total (€)</Label>
              <Input id="val" type="number" step="0.01" min="0" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dt">Data de entrega</Label>
              <Input id="dt" placeholder="ex: 22/05 ou Sábado" value={form.data_entrega} onChange={(e) => setForm({ ...form, data_entrega: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? "A guardar…" : "Criar encomenda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}