import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Check, X, Clock, CheckCircle2, XCircle, Phone, Plus, Layers, Loader2,
  Minus, Sparkles, Package, ChevronsUpDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/orders";
import type { Product } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/gestao-whatsapp")({
  component: GestaoWhatsAppPage,
});

/* ============================== Types ============================== */

type WhatsStatus = "pending" | "approved" | "rejected" | "converted";

type WhatsPending = {
  id: string;
  customer_name: string;
  phone: string;
  original_message: string;
  detected_products: string;
  estimated_total: number;
  status: WhatsStatus;
  created_at: string;
};

type FilterKey = "all" | "pending" | "approved" | "rejected";

type LineItem = { product_id: string; name: string; price: number; qty: number };

/* ============================== Helpers ============================== */

function formatReceivedAt(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Hoje, ${time}` : `${d.toLocaleDateString("pt-PT")} ${time}`;
}

/** Insert/convert a pending WhatsApp order into the official `orders` table. */
async function convertToOfficialOrder(p: WhatsPending) {
  const { error } = await supabase.from("orders").insert({
    customer_name: p.customer_name,
    phone: p.phone,
    address: "",
    products: p.detected_products || "—",
    quantity: 1,
    total_price: p.estimated_total ?? 0,
    notes: `Importada do WhatsApp:\n${p.original_message}`,
    status: "pendente",
  });
  if (error) throw error;
}

/** Loose accent-insensitive token. */
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Map written numbers (PT) to digits for simple quantity extraction. */
const WORD_NUMS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, dúzia: 12, duzia: 12,
};

/**
 * Heuristic product extraction from a free-text WhatsApp message.
 * Modular & swappable later by a Gemini call: same signature.
 */
function extractItemsFromMessage(message: string, products: Product[]): LineItem[] {
  if (!message.trim() || products.length === 0) return [];
  const text = ` ${norm(message)} `;
  const found = new Map<string, LineItem>();

  for (const p of products) {
    const tokens = norm(p.name).split(/\s+/).filter((t) => t.length > 2);
    if (!tokens.length) continue;
    // Require at least one distinctive token to be present.
    const hits = tokens.filter((t) => text.includes(t));
    if (hits.length === 0) continue;

    // Try to find a quantity right before the first hit.
    const anchor = hits[0];
    const idx = text.indexOf(anchor);
    const before = text.slice(Math.max(0, idx - 25), idx);
    let qty = 1;
    const numMatch = before.match(/(\d+)\s*x?\s*$/);
    if (numMatch) qty = Math.max(1, parseInt(numMatch[1], 10));
    else {
      const wordMatch = before.match(/(um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|duzia|dúzia)\s+$/);
      if (wordMatch) qty = WORD_NUMS[wordMatch[1]] ?? 1;
    }

    const existing = found.get(p.id);
    if (existing) existing.qty += qty;
    else found.set(p.id, { product_id: p.id, name: p.name, price: Number(p.price) || 0, qty });
  }

  return Array.from(found.values());
}

function itemsToText(items: LineItem[]) {
  return items.map((i) => `${i.qty}x ${i.name}`).join(", ");
}
/* ============================== Page ============================== */

function GestaoWhatsAppPage() {
  const [items, setItems] = useState<WhatsPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [form, setForm] = useState({ cliente: "", telefone: "", mensagem: "" });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const resetForm = () => {
    setForm({ cliente: "", telefone: "", mensagem: "" });
    setLineItems([]);
    setAutoFilled(false);
  };

  const totalEstimado = useMemo(
    () => lineItems.reduce((s, i) => s + i.price * i.qty, 0),
    [lineItems],
  );

  /* ---------- load products when dialog opens ---------- */
  useEffect(() => {
    if (!simOpen || products.length > 0) return;
    setProductsLoading(true);
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setProducts((data ?? []) as Product[]);
        setProductsLoading(false);
      });
  }, [simOpen, products.length]);

  /* ---------- auto-extract from message (debounced) ---------- */
  useEffect(() => {
    if (!simOpen || !form.mensagem.trim() || products.length === 0) return;
    const t = setTimeout(() => {
      const guesses = extractItemsFromMessage(form.mensagem, products);
      if (guesses.length === 0) return;
      // Merge non-destructively: keep manual quantities, add missing ones.
      setLineItems((curr) => {
        const map = new Map(curr.map((i) => [i.product_id, i]));
        let added = 0;
        for (const g of guesses) {
          if (!map.has(g.product_id)) { map.set(g.product_id, g); added += 1; }
        }
        if (added > 0) setAutoFilled(true);
        return Array.from(map.values());
      });
    }, 400);
    return () => clearTimeout(t);
  }, [form.mensagem, products, simOpen]);

  /* ---------- line item helpers ---------- */
  const addProduct = (p: Product) => {
    setLineItems((curr) => {
      const existing = curr.find((i) => i.product_id === p.id);
      if (existing) return curr.map((i) => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...curr, { product_id: p.id, name: p.name, price: Number(p.price) || 0, qty: 1 }];
    });
    setPickerOpen(false);
  };
  const changeQty = (id: string, delta: number) => {
    setLineItems((curr) =>
      curr
        .map((i) => i.product_id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter((i) => i.qty > 0),
    );
  };
  const removeLine = (id: string) => setLineItems((curr) => curr.filter((i) => i.product_id !== id));

  /* ---------- load + realtime ---------- */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("whatsapp_pending_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) toast.error(error.message);
      else setItems((data ?? []) as WhatsPending[]);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("whatsapp-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_pending_orders" }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  /* ---------- counters ---------- */
  const counts = useMemo(() => {
    const todayStr = new Date().toDateString();
    const isToday = (iso: string) => new Date(iso).toDateString() === todayStr;
    return {
      all: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      approved: items.filter((i) => (i.status === "approved" || i.status === "converted") && isToday(i.created_at)).length,
      rejected: items.filter((i) => i.status === "rejected").length,
    };
  }, [items]);

  /* ---------- filtered list ---------- */
  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "approved") return items.filter((i) => i.status === "approved" || i.status === "converted");
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  /* ---------- actions ---------- */
  const aceitar = async (o: WhatsPending) => {
    setActingId(o.id);
    // optimistic remove from pending view
    const prev = items;
    setItems((curr) => curr.map((i) => (i.id === o.id ? { ...i, status: "converted" } : i)));
    try {
      await convertToOfficialOrder(o);
      const { error } = await supabase
        .from("whatsapp_pending_orders")
        .update({ status: "converted" })
        .eq("id", o.id);
      if (error) throw error;
      toast.success("Encomenda adicionada com sucesso");
    } catch (e: any) {
      setItems(prev);
      toast.error(e?.message ?? "Falha ao aceitar encomenda");
    } finally {
      setActingId(null);
    }
  };

  const rejeitar = async (o: WhatsPending) => {
    setActingId(o.id);
    const prev = items;
    setItems((curr) => curr.map((i) => (i.id === o.id ? { ...i, status: "rejected" } : i)));
    const { error } = await supabase
      .from("whatsapp_pending_orders")
      .update({ status: "rejected" })
      .eq("id", o.id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    } else {
      toast.message("Encomenda rejeitada");
    }
    setActingId(null);
  };

  const inserirSimulacao = async () => {
    if (!form.cliente.trim() || !form.telefone.trim() || !form.mensagem.trim()) {
      toast.error("Preencha cliente, telefone e mensagem");
      return;
    }
    const { error } = await supabase.from("whatsapp_pending_orders").insert({
      customer_name: form.cliente.trim(),
      phone: form.telefone.trim(),
      original_message: form.mensagem.trim(),
      detected_products: lineItems.length ? itemsToText(lineItems) : "—",
      estimated_total: totalEstimado,
      status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Mensagem simulada inserida");
    resetForm();
    setSimOpen(false);
  };

  /* ---------- stat cards config ---------- */
  const cards: { key: FilterKey; label: string; value: number; icon: any; tone: string; ring: string }[] = [
    { key: "pending",  label: "Pendentes de Validação", value: counts.pending,  icon: Clock,        tone: "bg-amber-100/70 text-amber-900 border-amber-200",   ring: "ring-amber-300" },
    { key: "approved", label: "Aprovadas Hoje",         value: counts.approved, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-900 border-emerald-200", ring: "ring-emerald-300" },
    { key: "rejected", label: "Rejeitadas",             value: counts.rejected, icon: XCircle,      tone: "bg-rose-100 text-rose-900 border-rose-200",         ring: "ring-rose-300" },
    { key: "all",      label: "Todas",                  value: counts.all,      icon: Layers,       tone: "bg-stone-100 text-stone-900 border-stone-200",       ring: "ring-stone-300" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-accent-foreground" />
            </div>
            <h1 className="font-display text-3xl font-semibold text-primary">
              Validação de Encomendas WhatsApp
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Reveja e valide as encomendas recebidas via WhatsApp antes de serem processadas.
          </p>
        </div>
        <Button size="lg" onClick={() => setSimOpen(true)} className="bg-primary hover:bg-primary/90 shadow-soft self-start md:self-auto">
          <Plus className="h-4 w-4 mr-1.5" /> Simular Mensagem
        </Button>
      </header>

      {/* Stat cards (clickable filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const active = filter === c.key;
          return (
            <motion.button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`text-left rounded-lg transition-all focus:outline-none ${active ? `ring-2 ${c.ring} ring-offset-2 ring-offset-background` : ""}`}
            >
              <Card className={`p-4 bg-card/70 backdrop-blur-sm border-border/70 shadow-soft transition-shadow ${active ? "shadow-elegant" : "hover:shadow-elegant"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${c.tone}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                    <div className="font-display text-2xl font-semibold text-primary leading-tight">{c.value}</div>
                  </div>
                </div>
              </Card>
            </motion.button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <Card className="p-10 text-center bg-card/70 backdrop-blur-sm border-border/70 shadow-soft">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-10 bg-card/70 backdrop-blur-sm border-border/70 shadow-soft text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg text-primary mb-1">
            {filter === "pending" ? "Sem encomendas pendentes" : "Sem registos para este filtro"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filter === "pending"
              ? "Todas as encomendas recebidas foram processadas."
              : "Altera o filtro para ver outros registos."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {visible.map((o, i) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.03 }}
              >
                <PendingCard order={o} acting={actingId === o.id} onAccept={aceitar} onReject={rejeitar} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Simulate dialog */}
      <Dialog open={simOpen} onOpenChange={(o) => { setSimOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">Simular Mensagem WhatsApp</DialogTitle>
            <DialogDescription>
              Adiciona uma encomenda de teste à lista de validação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sim-cliente">Nome do Cliente</Label>
                <Input id="sim-cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Ex: Ana Ribeiro" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sim-telefone">Telefone</Label>
                <Input id="sim-telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="+351 912 000 000" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sim-msg">Texto da mensagem</Label>
              <Textarea id="sim-msg" rows={4} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Olá, gostava de encomendar..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sim-total">Valor Estimado (€)</Label>
                <Input
                  id="sim-total"
                  readOnly
                  tabIndex={-1}
                  value={totalEstimado.toFixed(2).replace(".", ",")}
                  className="bg-muted/40 font-medium text-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sim-produtos">Produtos sugeridos</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="sim-produtos"
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal h-10 px-3"
                    >
                      <span className="text-muted-foreground inline-flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" />
                        {productsLoading ? "A carregar…" : "Adicionar produto"}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[280px]" align="end">
                    <Command>
                      <CommandInput placeholder="Procurar produto…" />
                      <CommandList>
                        <CommandEmpty>Sem produtos.</CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem key={p.id} value={p.name} onSelect={() => addProduct(p)}>
                              <span className="flex-1 truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {formatCurrency(Number(p.price))}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Selected line items */}
            <AnimatePresence initial={false}>
              {lineItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-1.5 pt-1">
                    {autoFilled && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700">
                        <Sparkles className="h-3 w-3" />
                        Sugestões detetadas a partir da mensagem
                      </div>
                    )}
                    {lineItems.map((i) => (
                      <motion.div
                        key={i.product_id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{i.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatCurrency(i.price)} · subtotal {formatCurrency(i.price * i.qty)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i.product_id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <div className="w-7 text-center text-sm font-medium tabular-nums">{i.qty}</div>
                          <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i.product_id, +1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => removeLine(i.product_id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSimOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={inserirSimulacao} className="bg-primary hover:bg-primary/90">Inserir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================== Card ============================== */

const STATUS_BADGE: Record<WhatsStatus, { label: string; cls: string }> = {
  pending:   { label: "Pendente",   cls: "bg-amber-100/70 text-amber-900 border-amber-200" },
  approved:  { label: "Aprovada",   cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  converted: { label: "Convertida", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  rejected:  { label: "Rejeitada",  cls: "bg-rose-100 text-rose-900 border-rose-200" },
};

function PendingCard({
  order, acting, onAccept, onReject,
}: {
  order: WhatsPending;
  acting: boolean;
  onAccept: (o: WhatsPending) => void;
  onReject: (o: WhatsPending) => void;
}) {
  const badge = STATUS_BADGE[order.status];
  const isPending = order.status === "pending";
  return (
    <Card className="p-5 bg-card/70 backdrop-blur-sm border-border/70 shadow-soft">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
            <h3 className="font-display text-lg font-semibold text-primary">{order.customer_name}</h3>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />{order.phone}
            </span>
            <span className="text-xs text-muted-foreground italic">• {formatReceivedAt(order.created_at)}</span>
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          <p className="text-sm text-foreground/90 mb-3">{order.detected_products || "—"}</p>

          <div className="relative inline-block max-w-xl">
            <div className="rounded-2xl rounded-tl-sm bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-950 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-700/80 mb-1">
                <MessageCircle className="h-3 w-3" />
                Mensagem original
              </div>
              {order.original_message || "—"}
            </div>
          </div>
        </div>

        <div className="flex md:flex-col md:items-end items-center justify-between gap-3 md:min-w-[200px]">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total estimado</div>
            <div className="font-display text-xl font-semibold text-primary">{formatCurrency(Number(order.estimated_total))}</div>
          </div>

          {isPending && (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={acting}
                onClick={() => onAccept(order)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {acting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={acting}
                onClick={() => onReject(order)}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              >
                <X className="h-4 w-4 mr-1.5" />
                Rejeitar
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
