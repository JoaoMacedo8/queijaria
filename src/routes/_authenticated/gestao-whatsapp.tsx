import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Check, X, Clock, CheckCircle2, XCircle, Phone, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao-whatsapp")({
  component: GestaoWhatsAppPage,
});

type WhatsOrder = {
  id: string;
  cliente: string;
  telefone: string;
  resumo: string;
  total: number;
  mensagem: string;
  recebidoEm: string;
};

const MOCK_ORDERS: WhatsOrder[] = [
  {
    id: "w1",
    cliente: "Carlos Antunes",
    telefone: "+351 912 345 678",
    resumo: "2x Queijo Amanteigado, 1x Requeijão Caseiro",
    total: 22.8,
    mensagem:
      "Boa tarde! Queria encomendar dois queijos amanteigados e um requeijão para levantar na sexta-feira de manhã, é possível? Obrigado.",
    recebidoEm: "Hoje, 10:24",
  },
  {
    id: "w2",
    cliente: "Sofia Marques",
    telefone: "+351 936 778 221",
    resumo: "1x Queijo Curado Tradicional, 3x Queijo Fresco",
    total: 26.0,
    mensagem:
      "Olá, gostava de encomendar um queijo curado e três queijos frescos. Entrega em Braga se possível 🙏",
    recebidoEm: "Hoje, 09:12",
  },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

function GestaoWhatsAppPage() {
  const [orders, setOrders] = useState<WhatsOrder[]>(MOCK_ORDERS);
  const [aprovadas, setAprovadas] = useState(5);
  const [rejeitadas, setRejeitadas] = useState(1);
  const [simOpen, setSimOpen] = useState(false);
  const [form, setForm] = useState({ cliente: "", telefone: "", mensagem: "", total: "", produtos: "" });

  const resetForm = () => setForm({ cliente: "", telefone: "", mensagem: "", total: "", produtos: "" });

  const inserirSimulacao = () => {
    if (!form.cliente.trim() || !form.telefone.trim() || !form.mensagem.trim()) {
      toast.error("Preencha cliente, telefone e mensagem");
      return;
    }
    const novo: WhatsOrder = {
      id: `sim-${Date.now()}`,
      cliente: form.cliente.trim(),
      telefone: form.telefone.trim(),
      resumo: form.produtos.trim() || "—",
      total: Number(form.total.replace(",", ".")) || 0,
      mensagem: form.mensagem.trim(),
      recebidoEm: "Agora",
    };
    setOrders((prev) => [novo, ...prev]);
    toast.success("Mensagem simulada inserida");
    resetForm();
    setSimOpen(false);
  };

  const aceitar = (o: WhatsOrder) => {
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    setAprovadas((n) => n + 1);
    toast.success(`Encomenda de ${o.cliente} aceite`);
  };

  const rejeitar = (o: WhatsOrder) => {
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    setRejeitadas((n) => n + 1);
    toast.message(`Encomenda de ${o.cliente} rejeitada`);
  };

  const stats = [
    { label: "Pendentes de Validação", value: orders.length, icon: Clock, tone: "bg-amber-100/70 text-amber-900 border-amber-200" },
    { label: "Aprovadas Hoje", value: aprovadas, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-900 border-emerald-200" },
    { label: "Rejeitadas", value: rejeitadas, icon: XCircle, tone: "bg-rose-100 text-rose-900 border-rose-200" },
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 bg-card/70 backdrop-blur-sm border-border/70 shadow-soft">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className="font-display text-2xl font-semibold text-primary leading-tight">{s.value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card className="p-10 bg-card/70 backdrop-blur-sm border-border/70 shadow-soft text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg text-primary mb-1">Sem encomendas pendentes</h2>
          <p className="text-sm text-muted-foreground">Todas as encomendas recebidas foram processadas.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5 bg-card/70 backdrop-blur-sm border-border/70 shadow-soft">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                      <h3 className="font-display text-lg font-semibold text-primary">{o.cliente}</h3>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {o.telefone}
                      </span>
                      <span className="text-xs text-muted-foreground italic">• {o.recebidoEm}</span>
                    </div>

                    <p className="text-sm text-foreground/90 mb-3">{o.resumo}</p>

                    <div className="relative inline-block max-w-xl">
                      <div className="rounded-2xl rounded-tl-sm bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-950 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-700/80 mb-1">
                          <MessageCircle className="h-3 w-3" />
                          Mensagem original
                        </div>
                        {o.mensagem}
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col md:items-end items-center justify-between gap-3 md:min-w-[200px]">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total estimado</div>
                      <div className="font-display text-xl font-semibold text-primary">{formatCurrency(o.total)}</div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => aceitar(o)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                        <Check className="h-4 w-4 mr-1.5" />
                        Aceitar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejeitar(o)} className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800">
                        <X className="h-4 w-4 mr-1.5" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={simOpen} onOpenChange={(o) => { setSimOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">Simular Mensagem WhatsApp</DialogTitle>
            <DialogDescription>
              Adiciona uma encomenda de teste à lista local de validação.
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
                <Input id="sim-total" inputMode="decimal" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="0,00" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sim-produtos">Produtos sugeridos</Label>
                <Input id="sim-produtos" value={form.produtos} onChange={(e) => setForm({ ...form, produtos: e.target.value })} placeholder="2x Queijo Curado" />
              </div>
            </div>
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