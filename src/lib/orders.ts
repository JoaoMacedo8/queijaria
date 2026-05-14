import type { Tables } from "@/integrations/supabase/types";

export type Order = Tables<"orders">;
export type OrderStatus = Order["status"];

export const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_preparacao", label: "Em preparação" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelada", label: "Cancelada" },
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendente: "Pendente",
  em_preparacao: "Em preparação",
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
