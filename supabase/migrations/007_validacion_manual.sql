-- 007_validacion_manual.sql
-- Añade columnas de aprobación manual y restringe la lectura anónima
-- (REST API con anon key) a solo registros que un admin haya aprobado.
--
-- Contexto: la migración 005 dejó RLS DESHABILITADO y la 006 creó una
-- policy "Lectura pública" que queda en desuso. Esta migración
-- re-habilita RLS para que las nuevas policies SELECT efectivamente
-- gateen el acceso — sin ese paso, anon seguiría viendo todo por
-- los GRANT ALL de 005.

-- 1) Nuevas columnas ----------------------------------------------------------

ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS aprobado_mapa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprobado_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprobado_por  TEXT;

CREATE INDEX IF NOT EXISTS idx_evaluaciones_aprobado
  ON evaluaciones(aprobado_mapa);

-- 2) Limpiar SELECT policies existentes --------------------------------------
--
-- Nombres conocidos por historial de migrations (001 → 006).
-- IF EXISTS vuelve cada línea idempotente.

DROP POLICY IF EXISTS "Lectura pública"             ON evaluaciones;  -- 006
DROP POLICY IF EXISTS "Solo autenticados leen"      ON evaluaciones;  -- 001 (ya droppeada en 004, por seguridad)
DROP POLICY IF EXISTS "allow_authenticated_select"  ON evaluaciones;  -- 004

-- Red de seguridad: tira cualquier SELECT policy residual creada fuera
-- de las migrations (ej. desde el dashboard). Las policies INSERT/UPDATE/DELETE
-- se preservan.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'evaluaciones' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON evaluaciones', pol.policyname);
  END LOOP;
END $$;

-- 3) Re-habilitar RLS ---------------------------------------------------------
-- La 005 lo apagó; a partir de aquí las policies sí gatean el acceso.

ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;

-- 4) Nuevas policies ----------------------------------------------------------

CREATE POLICY "anon_select_approved_only"
  ON evaluaciones FOR SELECT TO anon
  USING (aprobado_mapa = true);

CREATE POLICY "authenticated_select_all"
  ON evaluaciones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_update_all"
  ON evaluaciones FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_all"
  ON evaluaciones FOR DELETE TO authenticated
  USING (true);

-- INSERT: el formulario público debe seguir funcionando tras habilitar
-- RLS. No asumimos que la policy de migration 004 sobrevivió, así que
-- la (re)creamos aquí idempotentemente.
DROP POLICY IF EXISTS "public_insert" ON evaluaciones;
CREATE POLICY "public_insert"
  ON evaluaciones FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5) Aprobar registros existentes --------------------------------------------
-- Para que los 23 registros actuales (seeds + pruebas) no desaparezcan del
-- mapa público cuando el filtro anon_select_approved_only entre en vigor.

UPDATE evaluaciones
  SET aprobado_mapa = true,
      aprobado_at   = now(),
      aprobado_por  = 'seed'
  WHERE aprobado_mapa = false;

-- 6) Recargar cache de esquema de PostgREST ----------------------------------

NOTIFY pgrst, 'reload schema';
