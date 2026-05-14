import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { STATUS_OPTIONS, type Order, type OrderStatus } from "@/lib/orders";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order?: Order | null;
}

export function OrderDialog({ open, onOpenChange, order }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const isEdit = !!order;

  const [form, setForm] = useState(() => ({
    customer_name: order?.customer_name ?? "",
    phone: order?.phone ?? "",
    address: order?.address ?? "",
    products: order?.products ?? "",
    quantity: order?.quantity?.toString() ?? "1",
    total_price: order?.total_price?.toString() ?? "0",
    order_date: order?.order_date ?? new Date().toISOString().slice(0, 10),
    delivery_date: order?.delivery_date ?? "",
    status: (order?.status ?? "pendente") as OrderStatus,
    notes: order?.notes ?? "",
  }));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.phone.trim() || !form.address.trim() || !form.products.trim()) {
      toast.error("Preenche todos os campos obrigatórios.");
      return;
    }
    setBusy(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      products: form.products.trim(),
      quantity: Number(form.quantity) || 1,
      total_price: Number(form.total_price) || 0,
      order_date: form.order_date,
      delivery_date: form.delivery_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
      created_by: user?.id ?? null,
    };
    const { error } = isEdit
      ? await supabase.from("orders").update(payload).eq("id", order!.id)
      : await supabase.from("orders").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isEdit ? "Encomenda atualizada" : "Encomenda criada");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            {isEdit ? "Editar encomenda" : "Nova encomenda"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Cliente *">
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} required />
            </Field>
            <Field label="Telefone *">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
            </Field>
          </div>
          <Field label="Morada *">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} required />
          </Field>
          <Field label="Produtos *">
            <Textarea
              value={form.products}
              onChange={(e) => set("products", e.target.value)}
              placeholder="ex: Queijo da Serra (500g), Requeijão (2 unid)"
              required
              rows={2}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Quantidade">
              <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <Field label="Preço total (€)">
              <Input type="number" step="0.01" min="0" value={form.total_price} onChange={(e) => set("total_price", e.target.value)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Data da encomenda">
              <Input type="date" value={form.order_date} onChange={(e) => set("order_date", e.target.value)} />
            </Field>
            <Field label="Data de entrega">
              <Input type="date" value={form.delivery_date} onChange={(e) => set("delivery_date", e.target.value)} />
            </Field>
          </div>
          <Field label="Estado">
            <Select value={form.status} onValueChange={(v) => set("status", v as OrderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
              {busy ? "A guardar…" : isEdit ? "Guardar" : "Criar encomenda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
