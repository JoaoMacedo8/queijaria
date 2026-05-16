import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Package, Clock, CheckCircle2, Euro, Plus, Factory, PackageCheck,
  AlertTriangle, Trophy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, type Order } from "@/lib/orders";
import type { Product } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const LOW_STOCK_THRESHOLD = 5;

function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadOrders = async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      setOrders(data ?? []);
    };
    const loadProducts = async () => {
      const { data } = await supabase.from("products").select("*");
      setProducts(data ?? []);
    };
    loadOrders();
    loadProducts();
    const ch = supabase
      .channel("dash-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadProducts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const total = orders.length;
  const pending = orders.filter((o) => o.status === "pendente").length;
  const inProduction = orders.filter((o) => o.status === "em_producao" || o.status === "em_preparacao").length;
  const ready = orders.filter((o) => o.status === "pronta").length;
  const delivered = orders.filter((o) => o.status === "entregue").length;
  const revenue = orders
    .filter((o) => o.status !== "cancelada")
    .reduce((s, o) => s + Number(o.total_price), 0);

  const lowStock = useMemo(
    () => products.filter((p) => p.active && Number(p.stock) <= LOW_STOCK_THRESHOLD),
    [products],
  );

  const topProduct = useMemo(() => {
    if (!products.length || !orders.length) return null;
    const counts = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "cancelada") continue;
      const text = o.products.toLowerCase();
      const qty = Number(o.quantity) || 1;
      for (const p of products) {
        if (text.includes(p.name.toLowerCase())) {
          counts.set(p.name, (counts.get(p.name) ?? 0) + qty);
        }
      }
    }
    let best: { name: string; qty: number } | null = null;
    for (const [name, qty] of counts) {
      if (!best || qty > best.qty) best = { name, qty };
    }
    return best;
  }, [products, orders]);

  const stats = [
    { label: "Total de encomendas", value: total, icon: Package, iconBg: "bg-primary/10 text-primary", accent: "from-primary/15 via-primary/5 to-transparent", filter: "all" as const },
    { label: "Pendentes", value: pending, icon: Clock, iconBg: "bg-amber-100 text-amber-700", accent: "from-amber-200/55 via-amber-100/20 to-transparent", filter: "pendente" as const },
    { label: "Em produção", value: inProduction, icon: Factory, iconBg: "bg-sky-100 text-sky-700", accent: "from-sky-200/50 via-sky-100/20 to-transparent", filter: "em_producao" as const },
    { label: "Prontas", value: ready, icon: PackageCheck, iconBg: "bg-emerald-100 text-emerald-700", accent: "from-emerald-200/50 via-emerald-100/20 to-transparent", filter: "pronta" as const },
    { label: "Entregues", value: delivered, icon: CheckCircle2, iconBg: "bg-green-800/15 text-green-900", accent: "from-green-200/40 via-green-100/15 to-transparent", filter: "entregue" as const },
    { label: "Vendas totais", value: formatCurrency(revenue), icon: Euro, iconBg: "bg-accent/40 text-accent-foreground", accent: "from-accent/40 via-accent/15 to-transparent", filter: null },
  ];

  const recent = orders.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground italic tracking-wide">Bem-vindo à Queijaria</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-primary mt-1">Dashboard</h1>
        </div>
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90 shadow-soft">
          <Link to="/encomendas"><Plus className="h-4 w-4 mr-1.5" /> Nova encomenda</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
        {stats.map((s, i) => {
          const cardInner = (
            <Card className={`p-4 md:p-5 bg-gradient-to-br ${s.accent} border-border/60 shadow-elegant hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden h-full ${s.filter !== null ? "cursor-pointer" : ""}`}>
              <div className={`h-9 w-9 rounded-lg ${s.iconBg} flex items-center justify-center mb-3`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="text-xl md:text-2xl font-display font-semibold text-primary leading-none">{s.value}</div>
              <div className="text-[11px] md:text-xs text-muted-foreground mt-2 leading-tight">{s.label}</div>
            </Card>
          );
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {s.filter !== null ? (
                <Link
                  to="/encomendas"
                  search={s.filter === "all" ? {} : { status: s.filter }}
                  className="block h-full"
                >
                  {cardInner}
                </Link>
              ) : cardInner}
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-5 md:p-6 shadow-elegant border-border/60 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-lg text-primary leading-tight">Stock baixo</h2>
                <p className="text-xs text-muted-foreground italic">≤ {LOW_STOCK_THRESHOLD} unidades</p>
              </div>
            </div>
            {lowStock.length === 0 ? (
              <div className="text-sm text-muted-foreground italic py-4">Stock saudável em todos os produtos.</div>
            ) : (
              <ul className="space-y-2">
                {lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                      {Number(p.stock)} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5 md:p-6 shadow-elegant border-border/60 h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-lg text-primary leading-tight">Produto mais vendido</h2>
                <p className="text-xs text-muted-foreground italic">Por volume de encomendas</p>
              </div>
            </div>
            {topProduct ? (
              <div className="py-2">
                <div className="text-2xl font-display text-primary">{topProduct.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{topProduct.qty} unidades encomendadas</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">Sem dados suficientes ainda.</div>
            )}
          </Card>
        </motion.div>
      </div>

      <Card className="overflow-hidden shadow-elegant border-border/60">
        <div className="p-5 md:p-6 border-b border-border/70 flex items-center justify-between bg-card/50">
          <div>
            <h2 className="font-display text-xl md:text-2xl text-primary">Encomendas recentes</h2>
            <p className="text-xs text-muted-foreground italic mt-0.5">Últimas 5 encomendas registadas</p>
          </div>
          <Link to="/encomendas" className="text-sm text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">Ver todas →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground italic">Ainda não há encomendas registadas.</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((o) => (
              <li key={o.id} className="px-5 md:px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{o.products}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-primary text-lg">{formatCurrency(Number(o.total_price))}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">{o.status.replace("_", " ")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
