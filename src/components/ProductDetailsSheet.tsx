import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Package, TrendingUp, TrendingDown, Settings2, History, AlertTriangle, X, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/orders";
import type { Product } from "@/lib/products";
import { toast } from "sonner";

type MovementType = "producao" | "venda" | "correcao" | "ajuste";

interface Movement {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  notes: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<MovementType, string> = {
  producao: "Produção",
  venda: "Venda",
  correcao: "Correção",
  ajuste: "Ajuste",
};

const TYPE_STYLES: Record<MovementType, string> = {
  producao: "bg-emerald-100 text-emerald-900 border-emerald-200",
  venda: "bg-sky-100 text-sky-900 border-sky-200",
  correcao: "bg-amber-100 text-amber-900 border-amber-200",
  ajuste: "bg-muted text-muted-foreground border-border",
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (p: Product) => void;
}

export function ProductDetailsSheet({ product, open, onOpenChange, onEdit }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [moveDialog, setMoveDialog] = useState<MovementType | null>(null);

  useEffect(() => {
    if (!product || !open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      if (error) toast.error(error.message);
      else setMovements((data ?? []) as Movement[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`stock-mov-${product.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements", filter: `product_id=eq.${product.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `id=eq.${product.id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [product, open]);

  if (!product) return null;

  const stock = Number(product.stock);
  const min = Number((product as Product & { min_stock?: number }).min_stock ?? 0);
  const low = min > 0 && stock <= min;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto p-0 bg-gradient-to-b from-[hsl(var(--background))] to-[hsl(var(--muted))]/40 border-l border-border/60"
        >
          <div className="flex flex-col animate-in fade-in-50 duration-300">
            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-border/50 bg-card/40 backdrop-blur-sm">
              <SheetHeader className="space-y-2 text-left">
                <p className="text-xs italic tracking-wider text-muted-foreground uppercase">Detalhes do produto</p>
                <SheetTitle className="font-display text-2xl text-primary leading-tight">{product.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border font-medium ${product.active ? "bg-emerald-100 text-emerald-900 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                    {product.active ? "Ativo" : "Inativo"}
                  </span>
                  {low && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border bg-rose-100 text-rose-900 border-rose-200 font-medium animate-pulse">
                      <AlertTriangle className="h-3 w-3" /> Stock baixo
                    </span>
                  )}
                </SheetDescription>
              </SheetHeader>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-6">
              {/* Info */}
              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-card border border-border/60 p-4 shadow-soft">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Preço</div>
                  <div className="font-display text-2xl text-primary">{formatCurrency(Number(product.price))}</div>
                </div>
                <div className={`rounded-lg border p-4 shadow-soft ${low ? "bg-rose-50/60 border-rose-200/70" : "bg-card border-border/60"}`}>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" /> Stock atual
                  </div>
                  <div className={`font-display text-2xl ${low ? "text-rose-900" : "text-primary"}`}>{stock}</div>
                  {min > 0 && <div className="text-xs text-muted-foreground mt-1">Mínimo: {min}</div>}
                </div>
              </section>

              {product.description && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Descrição</h3>
                  <div className="rounded-lg bg-card border border-border/60 p-4 text-sm shadow-soft whitespace-pre-wrap">
                    {product.description}
                  </div>
                </section>
              )}

              {/* Quick actions */}
              <section>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Movimentar stock</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMoveDialog("producao")} className="border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                    <Factory className="h-4 w-4 mr-1.5" /> Produzir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMoveDialog("venda")} className="border-sky-200 text-sky-800 hover:bg-sky-50">
                    <TrendingDown className="h-4 w-4 mr-1.5" /> Venda
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMoveDialog("correcao")} className="border-amber-200 text-amber-800 hover:bg-amber-50">
                    <Settings2 className="h-4 w-4 mr-1.5" /> Correção
                  </Button>
                </div>
              </section>

              {/* History */}
              <section>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 flex items-center gap-2">
                  <History className="h-3.5 w-3.5" /> Histórico de movimentos
                </h3>
                <div className="rounded-lg bg-card border border-border/60 shadow-soft overflow-hidden">
                  {loading ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">A carregar…</div>
                  ) : movements.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">Sem movimentos registados</div>
                  ) : (
                    <ul className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                      {movements.map((m) => {
                        const positive = Number(m.quantity) >= 0;
                        return (
                          <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TYPE_STYLES[m.type]}`}>
                                  {TYPE_LABEL[m.type]}
                                </span>
                                <span className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
                              </div>
                              {m.notes && <div className="text-xs text-muted-foreground truncate">{m.notes}</div>}
                            </div>
                            <div className={`font-display text-base whitespace-nowrap flex items-center gap-1 ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                              {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              {positive ? "+" : ""}{Number(m.quantity)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Separator />
                  <div className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/30">
                    {movements.length} movimento{movements.length === 1 ? "" : "s"}
                  </div>
                </div>
              </section>
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 px-6 py-4 border-t border-border/60 bg-card/80 backdrop-blur flex flex-wrap gap-2 justify-end">
              <Button size="sm" onClick={() => { onOpenChange(false); onEdit(product); }} className="bg-primary hover:bg-primary/90">
                <Pencil className="h-4 w-4 mr-1.5" /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-1.5" /> Fechar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {moveDialog && (
        <MovementDialog
          type={moveDialog}
          product={product}
          onClose={() => setMoveDialog(null)}
        />
      )}
    </>
  );
}

function MovementDialog({ type, product, onClose }: { type: MovementType; product: Product; onClose: () => void }) {
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const isOut = type === "venda";

  const titles: Record<MovementType, string> = {
    producao: "Registar produção",
    venda: "Registar venda",
    correcao: "Correção de stock",
    ajuste: "Ajuste",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!n || isNaN(n) || n <= 0) return toast.error("Quantidade inválida");
    setBusy(true);
    const signed = isOut ? -n : n;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("stock_movements").insert({
      product_id: product.id,
      type,
      quantity: signed,
      notes: notes.trim() || null,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Movimento registado"); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">{titles[type]}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-sm">
            <div className="font-medium">{product.name}</div>
            <div className="text-xs text-muted-foreground">Stock atual: {Number(product.stock)}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Quantidade {isOut ? "a retirar" : "a adicionar"}
            </Label>
            <Input type="number" step="1" min="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus required />
          </div>
          {type === "correcao" && (
            <p className="text-xs text-muted-foreground italic">
              Use valores positivos. Para corrigir para menos, registe como venda.
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
              {busy ? "A guardar…" : "Registar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}