import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Check, RotateCcw, Package, CalendarDays, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Order, OrderStatus } from "@/lib/orders";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/producao")({
  component: ProducaoPage,
});

// Estados que entram na lista de produção
const PRODUCTION_STATUSES: OrderStatus[] = ["pendente", "em_producao", "em_preparacao", "pronta"];

const PRODUCED_KEY = "producao:produzidos:v1";

type Filter = "hoje" | "amanha" | "semana" | "intervalo" | "todas";

function parseLines(text: string): { name: string; qty: number }[] {
  if (!text) return [];
  return text
    .split(/\n|;|,/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const qtyM = line.match(/^(\d+)\s*[x×]\s*/i);
      const name = line
        .replace(/^(\d+)\s*[x×]\s*/i, "")
        .replace(/[-–|]?\s*\d+[.,]?\d*\s*€.*$/, "")
        .trim();
      return { name: name || line, qty: qtyM ? Number(qtyM[1]) : 1 };
    })
    .filter((i) => i.name.length > 0);
}

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getRange(filter: Filter, from: string, to: string): { from?: string; to?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (filter === "hoje") {
    const d = isoDay(today);
    return { from: d, to: d };
  }
  if (filter === "amanha") {
    const t = new Date(today); t.setDate(t.getDate() + 1);
    const d = isoDay(t);
    return { from: d, to: d };
  }
  if (filter === "semana") {
    const end = new Date(today); end.setDate(end.getDate() + 6);
    return { from: isoDay(today), to: isoDay(end) };
  }
  if (filter === "intervalo") {
    return { from: from || undefined, to: to || undefined };
  }
  return {};
}

function withinRange(order: Order, range: { from?: string; to?: string }): boolean {
  const target = order.delivery_date ?? order.order_date;
  if (!target) return !range.from && !range.to;
  if (range.from && target < range.from) return false;
  if (range.to && target > range.to) return false;
  return true;
}

function loadProduced(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PRODUCED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProduced(p: Record<string, number>) {
  localStorage.setItem(PRODUCED_KEY, JSON.stringify(p));
}

function ProducaoPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("semana");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [produced, setProduced] = useState<Record<string, number>>({});

  useEffect(() => { setProduced(loadProduced()); }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", PRODUCTION_STATUSES);
      if (error) toast.error(error.message);
      else setOrders(data ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("producao-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const range = useMemo(() => getRange(filter, from, to), [filter, from, to]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; orders: number }>();
    for (const o of orders) {
      if (!withinRange(o, range)) continue;
      const items = parseLines(o.products);
      for (const it of items) {
        const key = normalizeKey(it.name);
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          existing.qty += it.qty;
          existing.orders += 1;
        } else {
          map.set(key, { name: it.name, qty: it.qty, orders: 1 });
        }
      }
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }, [orders, range]);

  const totals = useMemo(() => {
    const totalUnits = aggregated.reduce((s, a) => s + a.qty, 0);
    const producedUnits = aggregated.reduce((s, a) => s + Math.min(produced[a.key] ?? 0, a.qty), 0);
    const ordersInRange = orders.filter((o) => withinRange(o, range)).length;
    return {
      totalUnits,
      producedUnits,
      remaining: Math.max(totalUnits - producedUnits, 0),
      ordersInRange,
      products: aggregated.length,
      pct: totalUnits ? Math.round((producedUnits / totalUnits) * 100) : 0,
    };
  }, [aggregated, produced, orders, range]);

  const setProd = (key: string, value: number) => {
    const next = { ...produced, [key]: Math.max(0, value) };
    setProduced(next);
    saveProduced(next);
  };

  const markAll = (key: string, qty: number) => setProd(key, qty);
  const reset = (key: string) => setProd(key, 0);
  const resetAll = () => { setProduced({}); saveProduced({}); toast.success("Progresso reiniciado"); };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground italic tracking-wide">Plano automático</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-primary mt-1 flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-accent-foreground/80" />
            Produção
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll} className="self-start sm:self-end">
          <RotateCcw className="h-4 w-4 mr-1.5" /> Reiniciar progresso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Encomendas" value={totals.ordersInRange} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Produtos distintos" value={totals.products} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Unidades a fabricar" value={totals.totalUnits} highlight />
        <StatCard label="Em falta" value={totals.remaining} accent={totals.remaining === 0 ? "done" : "pending"} />
      </div>

      {/* Filters */}
      <Card className="p-4 md:p-5 shadow-soft border-border/60 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {([
            { v: "hoje", l: "Hoje" },
            { v: "amanha", l: "Amanhã" },
            { v: "semana", l: "Esta semana" },
            { v: "todas", l: "Todas" },
            { v: "intervalo", l: "Intervalo" },
          ] as { v: Filter; l: string }[]).map((b) => (
            <Button
              key={b.v}
              size="sm"
              variant={filter === b.v ? "default" : "outline"}
              onClick={() => setFilter(b.v)}
              className="h-8 rounded-full text-xs"
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {b.l}
            </Button>
          ))}
          {filter === "intervalo" && (
            <div className="flex items-center gap-2 ml-1">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-auto" />
              <span className="text-muted-foreground text-xs">→</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-auto" />
              {(from || to) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFrom(""); setTo(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Global progress */}
        <div className="pt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progresso geral</span>
            <span>{totals.producedUnits} / {totals.totalUnits} unidades ({totals.pct}%)</span>
          </div>
          <Progress value={totals.pct} className="h-2" />
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <Card className="p-12 text-center text-muted-foreground italic">A carregar plano de produção…</Card>
      ) : aggregated.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground italic">
          Sem encomendas a produzir para este período.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {aggregated.map((a, i) => {
              const done = Math.min(produced[a.key] ?? 0, a.qty);
              const pct = a.qty ? Math.round((done / a.qty) * 100) : 0;
              const completed = done >= a.qty;
              return (
                <motion.div
                  key={a.key}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Card className={`p-5 shadow-soft border-border/60 hover:shadow-elegant transition-all relative overflow-hidden ${completed ? "bg-emerald-50/60 border-emerald-200" : ""}`}>
                    {completed && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white border-0">
                          <Check className="h-3 w-3 mr-1" /> Concluído
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 text-primary font-display text-lg flex items-center justify-center font-semibold">
                        {a.qty}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-primary leading-tight truncate pr-16">{a.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.orders} {a.orders === 1 ? "encomenda" : "encomendas"} · {a.qty} un. a fabricar
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Produzido</span>
                        <span className="font-medium">{done} / {a.qty}</span>
                      </div>
                      <Progress value={pct} className={`h-2 ${completed ? "[&>div]:bg-emerald-500" : ""}`} />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => setProd(a.key, done - 1)}
                        disabled={done === 0}
                      >−</Button>
                      <Input
                        type="number"
                        min={0}
                        max={a.qty}
                        value={done}
                        onChange={(e) => setProd(a.key, Math.min(Number(e.target.value) || 0, a.qty))}
                        className="h-8 text-center w-16"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => setProd(a.key, Math.min(done + 1, a.qty))}
                        disabled={completed}
                      >+</Button>
                      {completed ? (
                        <Button size="sm" variant="ghost" className="h-8 ml-auto text-muted-foreground" onClick={() => reset(a.key)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Repor
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 ml-auto bg-primary hover:bg-primary/90"
                          onClick={() => markAll(a.key, a.qty)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Marcar produzido
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, highlight, accent,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  highlight?: boolean;
  accent?: "done" | "pending";
}) {
  const tone =
    accent === "done" ? "text-emerald-700" :
    accent === "pending" ? "text-amber-700" :
    highlight ? "text-primary" : "text-foreground";
  return (
    <Card className="p-4 shadow-soft border-border/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className={`font-display text-3xl ${tone}`}>{value}</div>
    </Card>
  );
}