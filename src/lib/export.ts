import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Order } from "./orders";
import { STATUS_LABEL, formatCurrency, formatDate } from "./orders";

export function exportPDF(orders: Order[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Encomendas — Queijaria", 14, 18);
  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-PT")}`, 14, 25);

  autoTable(doc, {
    startY: 32,
    head: [["Cliente", "Telefone", "Produtos", "Qtd", "Total", "Entrega", "Estado"]],
    body: orders.map((o) => [
      o.customer_name,
      o.phone,
      o.products,
      String(o.quantity),
      formatCurrency(Number(o.total_price)),
      formatDate(o.delivery_date),
      STATUS_LABEL[o.status],
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [107, 78, 50] },
  });

  doc.save(`encomendas-${Date.now()}.pdf`);
}

export function exportExcel(orders: Order[]) {
  const ws = XLSX.utils.json_to_sheet(
    orders.map((o) => ({
      Cliente: o.customer_name,
      Telefone: o.phone,
      Morada: o.address,
      Produtos: o.products,
      Quantidade: o.quantity,
      "Preço total (€)": Number(o.total_price),
      "Data encomenda": o.order_date,
      "Data entrega": o.delivery_date ?? "",
      Estado: STATUS_LABEL[o.status],
      Observações: o.notes ?? "",
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Encomendas");
  XLSX.writeFile(wb, `encomendas-${Date.now()}.xlsx`);
}
