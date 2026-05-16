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

export interface ParsedOrderItem {
  name: string;
  qty: number;
  price?: number;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function parseOrderItems(productsText: string, fallbackQuantity = 1): ParsedOrderItem[] {
  if (!productsText) return [];

  const rawItems = productsText
    .split(/\n|;|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const qtyMatch = line.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*/i);
      const priceMatch = line.match(/(\d+[.,]?\d*)\s*€/i);
      const name = line
        .replace(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*/i, "")
        .replace(/[-–|]?\s*(\d+[.,]?\d*)\s*€.*$/i, "")
        .trim();

      return {
        name: name || line,
        qty: qtyMatch ? Number(qtyMatch[1].replace(",", ".")) : null,
        price: priceMatch ? Number(priceMatch[1].replace(",", ".")) : undefined,
      };
    });

  const safeFallback = Number(fallbackQuantity) > 0 ? Number(fallbackQuantity) : 1;

  return rawItems.map((item, index, list) => ({
    name: item.name,
    qty: item.qty ?? (list.length === 1 && index === 0 ? safeFallback : 1),
    price: item.price,
  }));
}

export function formatOrderItemLabel(item: ParsedOrderItem) {
  return item.qty > 1 ? `${formatQuantity(item.qty)}x ${item.name}` : item.name;
}

export function formatOrderProducts(order: Pick<Order, "products" | "quantity">) {
  return parseOrderItems(order.products, Number(order.quantity) || 1)
    .map(formatOrderItemLabel)
    .join(", ");
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT");
}
