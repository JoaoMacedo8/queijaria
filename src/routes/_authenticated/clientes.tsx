import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, Star, Phone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { STATUS_LABEL, formatCurrency, formatDate, formatOrderProducts, type Order } from "@/lib/orders";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

type Customer = {
  key: string;
  name: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
  orders: Order[];
};

function buildCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const o of orders) {
    const key = (o.phone?.trim() || o.customer_name.trim()).toLowerCase();
    const existing = map.get(key);
    const orderDate = o.order_date ?? o.created_at;
    if (existing) {
      existing.ordersCount += 1;
      if (o.status !== "cancelada") existing.totalSpent += Number(o.total_price);
      if (!existing.lastOrderDate || orderDate > existing.lastOrderDate) {
        existing.lastOrderDate = orderDate;
        existing.name = o.customer_name;
        existing.phone = o.phone;
      }
      existing.orders.push(o);
    } else {
      map.set(key, {
        key,
        name: o.customer_name,
        phone: o.phone,
        ordersCount: 1,
        totalSpent: o.status !== "cancelada" ? Number(o.total_price) : 0,
        lastOrderDate: orderDate,
        orders: [o],
      });
    }
  }
  const list = Array.from(map.values());
  list.forEach((c) => {
    c.orders.sort((a, b) =>
      (b.order_date ?? b.created_at).localeCompare(a.order_date ?? a.created_at),
    );
  });
  return list.sort((a, b) => b.totalSpent - a.totalSpent);
}

function ClientesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setOrders(data ?? []);
    };
    load();
    const ch = supabase
      .channel("clientes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const customers = useMemo(() => buildCustomers(orders), [orders]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const selectedLive = selected
    ? customers.find((c) => c.key === selected.key) ?? null
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground italic tracking-wide">Histórico e relacionamento</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-primary mt-1">Clientes</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
        </div>
      </div>

      <Card className="p-4 md:p-5 shadow-soft border-border/60">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nome ou telefone…"
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground italic">
          {customers.length === 0 ? "Ainda não há clientes." : "Nenhum cliente corresponde à pesquisa."}
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((c, i) => (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card
                  onClick={() => setSelected(c)}
                  className="p-4 cursor-pointer hover:shadow-elegant transition-shadow"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        {c.name}
                        {c.ordersCount >= 3 && (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground border border-accent/40 whitespace-nowrap">
                      {c.ordersCount} enc.
                    </span>
                  </div>
                  <div className="flex justify-between items-end mt-3">
                    <div className="text-xs text-muted-foreground">
                      Última: {formatDate(c.lastOrderDate)}
                    </div>
                    <div className="font-display text-lg text-primary">
                      {formatCurrency(c.totalSpent)}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="hidden md:block overflow-hidden shadow-elegant border-border/60">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="px-5 py-4 font-medium">Cliente</th>
                    <th className="px-5 py-4 font-medium">Telefone</th>
                    <th className="px-5 py-4 font-medium">Encomendas</th>
                    <th className="px-5 py-4 font-medium">Total gasto</th>
                    <th className="px-5 py-4 font-medium">Última encomenda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((c) => (
                    <tr
                      key={c.key}
                      onClick={() => setSelected(c)}
                      className="hover:bg-accent/10 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          {c.name}
                          {c.ordersCount >= 3 && (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{c.phone}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-accent/30 text-accent-foreground border border-accent/40">
                          {c.ordersCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-display text-primary">{formatCurrency(c.totalSpent)}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{formatDate(c.lastOrderDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLive && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
                  {selectedLive.name}
                  {selectedLive.ordersCount >= 3 && (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  )}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {selectedLive.phone}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Encomendas</div>
                  <div className="font-display text-xl text-primary mt-1">{selectedLive.ordersCount}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total gasto</div>
                  <div className="font-display text-xl text-primary mt-1">{formatCurrency(selectedLive.totalSpent)}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Última</div>
                  <div className="font-display text-sm text-primary mt-2">{formatDate(selectedLive.lastOrderDate)}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-primary mb-2">Histórico de encomendas</h3>
                <ul className="divide-y divide-border/50 border border-border/60 rounded-lg overflow-hidden">
                  {selectedLive.orders.map((o) => (
                    <li key={o.id} className="p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="text-sm truncate">{formatOrderProducts(o)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(o.order_date)} · {STATUS_LABEL[o.status]}
                          </div>
                        </div>
                        <div className="font-display text-primary whitespace-nowrap">
                          {formatCurrency(Number(o.total_price))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
