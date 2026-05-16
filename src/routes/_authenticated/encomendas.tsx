import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileDown, FileSpreadsheet, Pencil, Trash2, X, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OrderDialog } from "@/components/OrderDialog";
import { OrderDetailsSheet } from "@/components/OrderDetailsSheet";
import { STATUS_OPTIONS, STATUS_LABEL, formatCurrency, formatDate, type Order, type OrderStatus } from "@/lib/orders";
import { exportPDF, exportExcel } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encomendas")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  component: EncomendasPage,
});

const STATUS_COLORS: Record<OrderStatus, string> = {
  pendente: "bg-amber-100/70 text-amber-900 border-amber-200",
  em_producao: "bg-sky-100 text-sky-900 border-sky-200",
  em_preparacao: "bg-sky-100 text-sky-900 border-sky-200",
  pronta: "bg-emerald-100 text-emerald-900 border-emerald-200",
  entregue: "bg-green-800/15 text-green-900 border-green-800/30",
  cancelada: "bg-rose-100 text-rose-900 border-rose-200",
};

async function updateOrderStatus(id: string, status: OrderStatus) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) toast.error(error.message);
  else toast.success("Estado atualizado");
}

function normalizePhonePT(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("351")) return p;
  // remove leading zeros from local format
  p = p.replace(/^0+/, "");
  return `351${p}`;
}

function openWhatsApp(o: Order) {
  const phone = normalizePhonePT(o.phone || "");
  if (!phone || phone.length < 11) { toast.error("Cliente sem telefone válido"); return; }
  const msg = `Olá ${o.customer_name}, a sua encomenda da Serra D'Padrela está atualmente em estado: ${STATUS_LABEL[o.status]}. Total: ${formatCurrency(Number(o.total_price))}. Obrigado!`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  // api.whatsapp.com works more reliably on mobile when app not installed redirect
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  window.open(isMobile ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}` : url, "_blank");
}

function WhatsAppButton({ order, className = "" }: { order: Order; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => openWhatsApp(order)}
      title="Enviar WhatsApp"
      className={`text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
    </Button>
  );
}

function StatusBadgeSelect({ order }: { order: Order }) {
  return (
    <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v as OrderStatus)}>
      <SelectTrigger
        className={`h-7 px-2.5 py-0 text-xs rounded-full border w-auto gap-1.5 font-medium shadow-none focus:ring-0 ${STATUS_COLORS[order.status]}`}
      >
        <SelectValue>{STATUS_LABEL[order.status]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EncomendasPage() {
  const searchParams = Route.useSearch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.status ?? "all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = (o: Order) => { setDetailsOrder(o); setDetailsOpen(true); };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  useEffect(() => {
    if (searchParams.status) setStatusFilter(searchParams.status);
  }, [searchParams.status]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setOrders(data ?? []);
    };
    load();
    const ch = supabase
      .channel("orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (dateFrom && o.order_date < dateFrom) return false;
      if (dateTo && o.order_date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.customer_name.toLowerCase().includes(q) &&
            !o.phone.toLowerCase().includes(q) &&
            !o.products.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (o: Order) => { setEditing(o); setDialogOpen(true); };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("orders").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else toast.success("Encomenda eliminada");
    setDeleteId(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground italic tracking-wide">Histórico completo</p>
          <h1 className="text-3xl md:text-4xl font-display font-semibold text-primary mt-1">Encomendas</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="lg" onClick={() => exportPDF(filtered)} disabled={!filtered.length}>
            <FileDown className="h-4 w-4 mr-1.5" /> PDF
          </Button>
          <Button variant="outline" size="lg" onClick={() => exportExcel(filtered)} disabled={!filtered.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
          </Button>
          <Button size="lg" onClick={openNew} className="bg-primary hover:bg-primary/90 shadow-soft">
            <Plus className="h-4 w-4 mr-1.5" /> Nova
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-5 shadow-soft border-border/60 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, telefone ou produto…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="De" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Até" />
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-1">
          <span className="text-xs text-muted-foreground mr-1">Filtros rápidos:</span>
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s.value}
              type="button"
              size="sm"
              variant={statusFilter === s.value ? "default" : "outline"}
              onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
              className="h-7 rounded-full text-xs"
            >
              {s.label}
            </Button>
          ))}
          {(search || statusFilter !== "all" || dateFrom || dateTo) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}
              className="h-7 rounded-full text-xs ml-auto text-muted-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground italic">
          {orders.length === 0 ? "Ainda não há encomendas. Cria a primeira!" : "Nenhuma encomenda corresponde aos filtros."}
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card className="p-4 cursor-pointer hover:shadow-elegant transition-shadow" onClick={() => openDetails(o)}>
                  <div className="flex justify-between gap-2 mb-2" onClick={stop}>
                    <div className="font-medium truncate">{o.customer_name}</div>
                    <StatusBadgeSelect order={o} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                    <div>{o.phone}</div>
                    <div className="line-clamp-2">{o.products}</div>
                    <div>Entrega: {formatDate(o.delivery_date)}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="font-display text-lg text-primary">{formatCurrency(Number(o.total_price))}</div>
                    <div className="flex gap-1" onClick={stop}>
                      <WhatsAppButton order={o} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden shadow-elegant border-border/60">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/70">
                  <tr>
                    <th className="px-5 py-4 font-medium">Cliente</th>
                    <th className="px-5 py-4 font-medium">Telefone</th>
                    <th className="px-5 py-4 font-medium">Produtos</th>
                    <th className="px-5 py-4 font-medium">Total</th>
                    <th className="px-5 py-4 font-medium">Entrega</th>
                    <th className="px-5 py-4 font-medium">Estado</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => openDetails(o)}
                      className="cursor-pointer hover:bg-accent/20 transition-colors group"
                    >
                      <td className="px-5 py-4 font-medium">{o.customer_name}</td>
                      <td className="px-5 py-4 text-muted-foreground">{o.phone}</td>
                      <td className="px-5 py-4 max-w-xs truncate text-muted-foreground">{o.products}</td>
                      <td className="px-5 py-4 font-display text-primary">{formatCurrency(Number(o.total_price))}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{formatDate(o.delivery_date)}</td>
                      <td className="px-5 py-4" onClick={stop}>
                        <StatusBadgeSelect order={o} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={stop}>
                        <WhatsAppButton order={o} />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {dialogOpen && (
        <OrderDialog open={dialogOpen} onOpenChange={setDialogOpen} order={editing} />
      )}

      <OrderDetailsSheet
        order={detailsOrder}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={openEdit}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar encomenda?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
