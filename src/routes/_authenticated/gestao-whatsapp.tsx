import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gestao-whatsapp")({
  component: GestaoWhatsAppPage,
});

function GestaoWhatsAppPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-accent-foreground" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            Validação de Encomendas WhatsApp
          </h1>
        </div>
        <p className="text-muted-foreground text-sm ml-13">
          Reveja e valide as encomendas recebidas via WhatsApp antes de serem processadas.
        </p>
      </header>

      <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm shadow-soft p-10 min-h-[420px] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg text-primary mb-2">
            Sem encomendas pendentes de validação
          </h2>
          <p className="text-sm text-muted-foreground">
            Quando chegarem novas encomendas pelo WhatsApp, aparecerão aqui para revisão.
          </p>
        </div>
      </div>
    </div>
  );
}