-- Eliminar políticas anteriores y recrearlas
DROP POLICY IF EXISTS "Permitir inserts anónimos" ON evaluaciones;
DROP POLICY IF EXISTS "Solo autenticados leen" ON evaluaciones;

-- Recrear: cualquiera puede insertar
CREATE POLICY "allow_anon_insert"
  ON evaluaciones FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Recrear: solo autenticados leen
CREATE POLICY "allow_authenticated_select"
  ON evaluaciones FOR SELECT
  TO authenticated
  USING (true);

-- Verificar que RLS está habilitado
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
