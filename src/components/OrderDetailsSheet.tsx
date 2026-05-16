import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Printer, MessageCircle, User, Phone, Calendar, Package, StickyNote, X } from "lucide-react";
import { STATUS_OPTIONS, STATUS_LABEL, formatCurrency, formatDate, type Order, type OrderStatus } from "@/lib/orders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_COLORS: Record<OrderStatus, string> = {
  pendente: "bg-amber-100/70 text-amber-900 border-amber-200",
  em_producao: "bg-sky-100 text-sky-900 border-sky-200",
  em_preparacao: "bg-sky-100 text-sky-900 border-sky-200",
  pronta: "bg-emerald-100 text-emerald-900 border-emerald-200",
  entregue: "bg-green-800/15 text-green-900 border-green-800/30",
  cancelada: "bg-rose-100 text-rose-900 border-rose-200",
};

function parseProducts(text: string): { name: string; qty?: number; price?: number }[] {
  if (!text) return [];
  return text.split(/\n|;|,/).map((l) => l.trim()).filter(Boolean).map((line) => {
    // matches "2x Queijo Curado - 10,50€" or "Queijo 12€"
    const qtyM = line.match(/^(\d+)\s*[x×]\s*/i);
    const priceM = line.match(/(\d+[.,]?\d*)\s*€/);
    const name = line
      .replace(/^(\d+)\s*[x×]\s*/i, "")
      .replace(/[-–|]?\s*(\d+[.,]?\d*)\s*€.*$/, "")
      .trim();
    return {
      name: name || line,
      qty: qtyM ? Number(qtyM[1]) : undefined,
      price: priceM ? Number(priceM[1].replace(",", ".")) : undefined,
    };
  });
}

function normalizePhonePT(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("351")) return p;
  p = p.replace(/^0+/, "");
  return `351${p}`;
}

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (o: Order) => void;
}

export function OrderDetailsSheet({ order, open, onOpenChange, onEdit }: Props) {
  if (!order) return null;

  const items = parseProducts(order.products);
  const total = Number(order.total_price);

  const updateStatus = async (status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    if (error) toast.error(error.message);
    else toast.success("Estado atualizado");
  };

  const sendWhats = () => {
    const phone = normalizePhonePT(order.phone || "");
    if (!phone || phone.length < 11) { toast.error("Cliente sem telefone válido"); return; }
    const msg = `Olá ${order.customer_name}, a sua encomenda da Serra D'Padrela está atualmente em estado: ${STATUS_LABEL[order.status]}. Total: ${formatCurrency(total)}. Obrigado!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0 bg-gradient-to-b from-[hsl(var(--background))] to-[hsl(var(--muted))]/40 border-l border-border/60"
      >
        <div className="flex flex-col animate-in fade-in-50 duration-300">
              {/* Header */}
              <div className="px-6 pt-6 pb-5 border-b border-border/50 bg-card/40 backdrop-blur-sm">
                <SheetHeader className="space-y-2 text-left">
                  <p className="text-xs italic tracking-wider text-muted-foreground uppercase">Detalhes da encomenda</p>
                  <SheetTitle className="font-display text-2xl text-primary leading-tight">
                    {order.customer_name}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-3 text-xs">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                    <span className="text-muted-foreground">#{order.id.slice(0, 8)}</span>
                  </SheetDescription>
                </SheetHeader>
              </div>

              {/* Body */}
              <div className="px-6 py-6 space-y-6">
                {/* Cliente */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-2">
                    <User className="h-3.5 w-3.5" /> Cliente
                  </h3>
                  <div className="rounded-lg bg-card border border-border/60 p-4 space-y-2 shadow-soft">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{order.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{order.phone || "—"}</span>
                    </div>
                    {order.address && (
                      <div className="text-sm text-muted-foreground pt-1">{order.address}</div>
                    )}
                  </div>
                </section>

                {/* Produtos */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" /> Produtos
                  </h3>
                  <div className="rounded-lg bg-card border border-border/60 shadow-soft overflow-hidden">
                    {items.length > 0 ? (
                      <ul className="divide-y divide-border/50">
                        {items.map((it, i) => (
                          <li key={i} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              {it.qty && (
                                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-display text-xs flex items-center justify-center">
                                  {it.qty}
                                </span>
                              )}
                              <span className="truncate">{it.name}</span>
                            </div>
                            {it.price !== undefined && (
                              <span className="text-muted-foreground font-medium whitespace-nowrap">
                                {formatCurrency(it.price)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground italic">Sem detalhes</div>
                    )}
                    <Separator />
                    <div className="px-4 py-3 flex justify-between items-center bg-muted/30">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-display text-xl text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </section>

                {/* Estado */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Estado</h3>
                  <Select value={order.status} onValueChange={(v) => updateStatus(v as OrderStatus)}>
                    <SelectTrigger className="bg-card shadow-soft">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                {/* Datas */}
                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-card border border-border/60 p-4 shadow-soft">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Criada
                    </div>
                    <div className="text-sm font-medium">{formatDate(order.order_date)}</div>
                  </div>
                  <div className="rounded-lg bg-card border border-border/60 p-4 shadow-soft">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Entrega
                    </div>
                    <div className="text-sm font-medium">{formatDate(order.delivery_date)}</div>
                  </div>
                </section>

                {/* Notas */}
                {order.notes && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-2">
                      <StickyNote className="h-3.5 w-3.5" /> Observações
                    </h3>
                    <div className="rounded-lg bg-amber-50/60 border border-amber-200/60 p-4 text-sm text-amber-950 whitespace-pre-wrap shadow-soft">
                      {order.notes}
                    </div>
                  </section>
                )}
              </div>

              {/* Footer actions */}
              <div className="sticky bottom-0 px-6 py-4 border-t border-border/60 bg-card/80 backdrop-blur flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1.5" /> Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={sendWhats} className="text-emerald-700 hover:text-emerald-800">
                  <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
                </Button>
                <Button size="sm" onClick={() => { onOpenChange(false); onEdit(order); }} className="bg-primary hover:bg-primary/90">
                  <Pencil className="h-4 w-4 mr-1.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4 mr-1.5" /> Fechar
                </Button>
              </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}