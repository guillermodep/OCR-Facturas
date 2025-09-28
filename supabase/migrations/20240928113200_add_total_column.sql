-- Agregar campo 'total' a la tabla processed_invoices
ALTER TABLE processed_invoices
ADD COLUMN IF NOT EXISTS total DECIMAL(10,2);

-- Actualizar registros existentes con total calculado
UPDATE processed_invoices
SET total = (
  SELECT ROUND(SUM(
    CASE
      WHEN item->>'neto' IS NOT NULL AND item->>'iva' IS NOT NULL
      THEN (item->>'neto')::decimal * (1 + (item->>'iva')::decimal / 100)
      ELSE 0
    END
  ), 2)
  FROM jsonb_array_elements(items) AS item
)
WHERE total IS NULL;
