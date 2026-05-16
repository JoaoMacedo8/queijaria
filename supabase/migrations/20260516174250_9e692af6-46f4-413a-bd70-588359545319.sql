-- Nova tabela encomendas (separada da tabela orders existente)
CREATE TABLE public.encomendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente text NOT NULL,
  numero_whatsapp text NOT NULL,
  conteudo_pedido text NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  data_entrega text,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aceite', 'Em Preparação', 'Entregue')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encomendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view encomendas"
  ON public.encomendas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert encomendas"
  ON public.encomendas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update encomendas"
  ON public.encomendas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete encomendas"
  ON public.encomendas FOR DELETE TO authenticated USING (true);

-- Realtime
ALTER TABLE public.encomendas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.encomendas;

CREATE INDEX idx_encomendas_status ON public.encomendas(status);
CREATE INDEX idx_encomendas_created_at ON public.encomendas(created_at DESC);