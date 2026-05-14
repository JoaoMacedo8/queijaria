CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER TABLE public.products REPLICA IDENTITY FULL;

INSERT INTO public.products (name, description, price, stock) VALUES
  ('Queijo Curado', 'Queijo curado artesanal de pasta dura', 12.50, 0),
  ('Queijo Fresco', 'Queijo fresco do dia', 4.50, 0),
  ('Requeijão', 'Requeijão tradicional', 3.00, 0),
  ('Iogurte Artesanal', 'Iogurte natural artesanal', 2.50, 0),
  ('Manteiga Artesanal', 'Manteiga batida artesanal', 6.00, 0);