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
  line_count integer := 0;
BEGIN
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') THEN
    line_count := COALESCE(array_length(string_to_array(NEW.products, E'\n'), 1), 0);

    FOR line IN SELECT unnest(string_to_array(NEW.products, E'\n')) LOOP
      line := trim(line);
      CONTINUE WHEN line = '';
      qty_match := regexp_match(line, '^(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+?)(\s*[-–|]\s*\d|\s*\d+[.,]?\d*\s*€|$)', 'i');
      IF qty_match IS NOT NULL THEN
        qty := replace(qty_match[1], ',', '.')::numeric;
        pname := trim(qty_match[2]);
      ELSE
        qty := CASE WHEN line_count <= 1 THEN COALESCE(NEW.quantity, 1) ELSE 1 END;
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