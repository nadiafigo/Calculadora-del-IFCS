-- Permitir lectura pública para el mapa y analytics
-- Nota: RLS está deshabilitado (migración 005), esta policy
-- quedará lista para cuando se habilite RLS en el futuro.

CREATE POLICY "Lectura pública"
  ON evaluaciones FOR SELECT
  TO anon
  USING (true);
