-- Add min_stock to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock numeric NOT NULL DEFAULT 0;

-- Movement type enum
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('producao', 'venda', 'correcao', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view stock_movements" ON public.stock_movements;
CREATE POLICY "Authenticated view stock_movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert stock_movements" ON public.stock_movements;
CREATE POLICY "Authenticated insert stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins delete stock_movements" ON public.stock_movements;
CREATE POLICY "Admins delete stock_movements" ON public.stock_movements
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Apply movement -> update product stock
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.products
  SET stock = COALESCE(stock, 0) + NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Auto-decrement stock when order is delivered
CREATE OR REPLACE FUNCTION public.handle_order_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prod RECORD;
  line text;
  qty numeric;
  pname text;
  qty_match text[];
BEGIN
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') THEN
    FOR line IN SELECT unnest(string_to_array(NEW.products, E'\n')) LOOP
      line := trim(line);
      CONTINUE WHEN line = '';
      qty_match := regexp_match(line, '^(\d+)\s*[x×]\s*(.+?)(\s*[-–|]\s*\d|\s*\d+[.,]?\d*\s*€|$)', 'i');
      IF qty_match IS NOT NULL THEN
        qty := qty_match[1]::numeric;
        pname := trim(qty_match[2]);
      ELSE
        qty := 1;
        pname := regexp_replace(line, '\s*[-–|]?\s*\d+[.,]?\d*\s*€.*$', '', 'i');
        pname := trim(pname);
      END IF;
      SELECT id INTO prod FROM public.products WHERE lower(name) = lower(pname) LIMIT 1;
      IF prod.id IS NOT NULL THEN
        INSERT INTO public.stock_movements (product_id, type, quantity, notes)
        VALUES (prod.id, 'venda', -qty, 'Encomenda entregue #' || substr(NEW.id::text, 1, 8));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivered ON public.orders;
CREATE TRIGGER trg_order_delivered
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_delivered();