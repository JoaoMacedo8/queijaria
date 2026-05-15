import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle2, Euro, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, type Order } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      setOrders(data ?? []);
    };
    load();
    const ch = supabase
      .channel("orders-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const total = orders.length;
  const pending = orders.filter((o) => o.status === "pendente").length;
  const delivered = orders.filter((o) => o.status === "entregue").length;
  const revenue = orders
    .filter((o) => o.status !== "cancelada")
    .reduce((s, o) => s + Number(o.total_price), 0);

  const stats = [
    { label: "Total de encomendas", value: total, icon: Package, accent: "from-primary/15 via-primary/5 to-transparent", iconBg: "bg-primary/10 text-primary" },
    { label: "Pendentes", value: pending, icon: Clock, accent: "from-accent/40 via-accent/15 to-transparent", iconBg: "bg-accent/30 text-accent-foreground" },
    { label: "Entregues", value: delivered, icon: CheckCircle2, accent: "from-emerald-200/50 via-emerald-100/20 to-transparent", iconBg: "bg-emerald-100 text-emerald-700" },
    { label: "Vendido", value: formatCurrency(revenue), icon: Euro, accent: "from-amber-200/55 via-amber-100/20 to-transparent", iconBg: "bg-amber-100 text-amber-700" },
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className={`p-5 md:p-6 bg-gradient-to-br ${s.accent} border-border/60 shadow-elegant hover:shadow-lg transition-shadow relative overflow-hidden`}>
              <div className={`h-9 w-9 rounded-lg ${s.iconBg} flex items-center justify-center mb-4`}>
                <s.icon className="h-4.5 w-4.5" />
              </div>
              <div className="text-2xl md:text-3xl font-display font-semibold text-primary leading-none">{s.value}</div>
              <div className="text-xs md:text-sm text-muted-foreground mt-2">{s.label}</div>
            </Card>
          </motion.div>
        ))}
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
