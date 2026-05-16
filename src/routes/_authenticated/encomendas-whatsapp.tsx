import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Check, X, Clock, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encomendas-whatsapp")({
  component: EncomendasWhatsappPage,
});

type EncomendaWhatsapp = {
  id: string;
  nome_cliente: string;
  telefone: string;
  produtos_texto: string;
  valor_estimado: number;
  status_validacao: string;
  created_at: string;
};

function fmtEUR(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function fmtCreated(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function EncomendasWhatsappPage() {
  const [items, setItems] = useState<EncomendaWhatsapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("encomendas_whatsapp")
      .select("*")
      .eq("status_validacao", "Aguardar Validação")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar encomendas");
      return;
    }
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = (supabase as any)
      .channel("encomendas_whatsapp_validacao")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encomendas_whatsapp" },
        () => load(),
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aprovar = async (item: EncomendaWhatsapp) => {
    setBusyId(item.id);
    try {
      const { error: insertErr } = await (supabase as any).from("orders").insert({
        customer_name: item.nome_cliente,
        phone: item.telefone,
        address: "A definir (via WhatsApp)",
        products: item.produtos_texto,
        quantity: 1,
        total_price: item.valor_estimado ?? 0,
        status: "pendente",
      });
      if (insertErr) throw insertErr;

      const { error: updErr } = await (supabase as any)
        .from("encomendas_whatsapp")
        .update({ status_validacao: "Aprovado" })
        .eq("id", item.id);
      if (updErr) throw updErr;

      toast.success("Encomenda aprovada e enviada");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aprovar");
    } finally {
      setBusyId(null);
    }
  };

  const recusar = async (item: EncomendaWhatsapp) => {
    setBusyId(item.id);
    try {
      const { error } = await (supabase as any)
        .from("encomendas_whatsapp")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      toast.success("Encomenda recusada");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao recusar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageCircle className="h-7 w-7 text-accent-foreground" />
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-primary">
            Validar WhatsApp
          </h1>
        </div>
        <p className="text-muted-foreground">
          Sala de espera de pedidos recebidos via WhatsApp. Aprove para enviar para Encomendas ou recuse se for erro/spam.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">A carregar…</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center bg-card/70 backdrop-blur-sm">
          <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
          <div className="font-display text-lg text-primary mb-1">Sem pedidos a validar</div>
          <div className="text-sm text-muted-foreground">
            Os novos pedidos vindos do WhatsApp aparecem aqui automaticamente.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-5 bg-card/80 backdrop-blur-sm shadow-soft border-border/70 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-lg font-semibold text-primary leading-tight">
                        {item.nome_cliente}
                      </div>
                      <a
                        href={`tel:${item.telefone}`}
                        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 mt-0.5"
                      >
                        <Phone className="h-3.5 w-3.5" /> {item.telefone}
                      </a>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full border bg-amber-100/70 text-amber-900 border-amber-200 whitespace-nowrap">
                      {item.status_validacao}
                    </span>
                  </div>

                  <div className="rounded-lg bg-muted/50 border border-border/60 p-3 text-sm text-foreground whitespace-pre-wrap">
                    {item.produtos_texto}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor estimado</span>
                    <span className="font-medium text-primary">{fmtEUR(Number(item.valor_estimado))}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Recebido em {fmtCreated(item.created_at)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      onClick={() => aprovar(item)}
                      disabled={busyId === item.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-1.5" /> Aprovar e Enviar
                    </Button>
                    <Button
                      onClick={() => recusar(item)}
                      disabled={busyId === item.id}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                    >
                      <X className="h-4 w-4 mr-1.5" /> Recusar
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}