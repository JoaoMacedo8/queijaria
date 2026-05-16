
CREATE TABLE IF NOT EXISTS public.whatsapp_pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  original_message text NOT NULL DEFAULT '',
  detected_products text NOT NULL DEFAULT '',
  estimated_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','converted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view whatsapp_pending_orders"
  ON public.whatsapp_pending_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert whatsapp_pending_orders"
  ON public.whatsapp_pending_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update whatsapp_pending_orders"
  ON public.whatsapp_pending_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete whatsapp_pending_orders"
  ON public.whatsapp_pending_orders FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_whatsapp_pending_orders_updated_at
  BEFORE UPDATE ON public.whatsapp_pending_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_orders_status ON public.whatsapp_pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_orders_created_at ON public.whatsapp_pending_orders(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_pending_orders;
ALTER TABLE public.whatsapp_pending_orders REPLICA IDENTITY FULL;
