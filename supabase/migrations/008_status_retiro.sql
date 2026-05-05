-- 008_status_retiro.sql
-- Status de retiro de puentes (gestión interna).
-- Aplica solo a registros administrados, no se expone en el formulario público.
--
-- Las dos columnas se rellenan a mano desde el panel admin (admin.html) o
-- desde el dashboard de Supabase. Heredan las RLS policies definidas en 007:
--   - anon SELECT donde aprobado_mapa = true
--   - authenticated UPDATE/DELETE/SELECT all
-- por lo que NO modificamos RLS aquí.

-- 1) Columnas ----------------------------------------------------------------

ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS status_retiro TEXT
    CHECK (status_retiro IS NULL OR status_retiro IN ('Pendiente', 'Retirado'));

ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS fecha_retiro TEXT;

COMMENT ON COLUMN evaluaciones.status_retiro IS
  'Status de sustitución del puente. NULL = no evaluado, Pendiente = aún no sustituido, Retirado = sustituido por cruce a nivel.';

COMMENT ON COLUMN evaluaciones.fecha_retiro IS
  'Fecha aproximada de retiro como texto libre (ej: "Mayo, 2019"). Solo aplica cuando status_retiro = Retirado.';

-- 2) Índice parcial sobre los no-NULL ----------------------------------------

CREATE INDEX IF NOT EXISTS idx_evaluaciones_status_retiro
  ON evaluaciones(status_retiro)
  WHERE status_retiro IS NOT NULL;

-- 3) Recargar cache de esquema de PostgREST -----------------------------------
-- Sin esto, el REST API sigue devolviendo el esquema viejo y el frontend no
-- vería las nuevas columnas hasta que PostgREST reinicie por su cuenta.

NOTIFY pgrst, 'reload schema';
