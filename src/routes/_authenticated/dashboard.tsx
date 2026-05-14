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
    { label: "Total de encomendas", value: total, icon: Package, accent: "from-primary/10 to-primary/5" },
    { label: "Pendentes", value: pending, icon: Clock, accent: "from-accent/40 to-accent/10" },
    { label: "Entregues", value: delivered, icon: CheckCircle2, accent: "from-emerald-200/50 to-emerald-100/20" },
    { label: "Vendido", value: formatCurrency(revenue), icon: Euro, accent: "from-amber-200/50 to-amber-100/20" },
  ];

  const recent = orders.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground italic">Bem-vindo de volta</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-primary">Dashboard</h1>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/encomendas"><Plus className="h-4 w-4 mr-1.5" /> Nova encomenda</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className={`p-5 bg-gradient-to-br ${s.accent} border-border/60 overflow-hidden relative`}>
              <s.icon className="h-5 w-5 text-primary/70 mb-3" />
              <div className="text-2xl md:text-3xl font-display font-semibold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">Encomendas recentes</h2>
          <Link to="/encomendas" className="text-sm text-muted-foreground hover:text-primary">Ver todas →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground italic">Ainda não há encomendas registadas.</div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((o) => (
              <li key={o.id} className="p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.products}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-primary">{formatCurrency(Number(o.total_price))}</div>
                  <div className="text-xs text-muted-foreground capitalize">{o.status.replace("_", " ")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
