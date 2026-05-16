CREATE TABLE public.encomendas_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente text NOT NULL,
  telefone text NOT NULL,
  produtos_texto text NOT NULL,
  valor_estimado numeric NOT NULL DEFAULT 0,
  status_validacao text NOT NULL DEFAULT 'Aguardar Validação',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encomendas_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view encomendas_whatsapp"
  ON public.encomendas_whatsapp FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert encomendas_whatsapp"
  ON public.encomendas_whatsapp FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update encomendas_whatsapp"
  ON public.encomendas_whatsapp FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete encomendas_whatsapp"
  ON public.encomendas_whatsapp FOR DELETE TO authenticated USING (true);

ALTER TABLE public.encomendas_whatsapp REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.encomendas_whatsapp;

CREATE INDEX idx_encomendas_whatsapp_created_at ON public.encomendas_whatsapp(created_at DESC);
CREATE INDEX idx_encomendas_whatsapp_status ON public.encomendas_whatsapp(status_validacao);