import type { Tables } from "@/integrations/supabase/types";

export type Order = Tables<"orders">;
export type OrderStatus = Order["status"];

export const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_producao", label: "Em Produção" },
  { value: "pronta", label: "Pronta" },
  { value: "entregue", label: "Entregue" },
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendente: "Pendente",
  em_producao: "Em Produção",
  em_preparacao: "Em Produção",
  pronta: "Pronta",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT");
}
