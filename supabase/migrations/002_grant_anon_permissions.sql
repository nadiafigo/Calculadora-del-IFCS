-- Permitir al rol anon acceder al schema public y hacer INSERT en evaluaciones
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON TABLE evaluaciones TO anon;

-- Permitir al rol authenticated leer
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE evaluaciones TO authenticated;
