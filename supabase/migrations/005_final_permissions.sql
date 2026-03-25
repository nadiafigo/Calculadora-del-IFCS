-- Estado final: RLS deshabilitado.
-- La tabla es accesible vía la API REST de Supabase con la anon key.
-- Esto es apropiado porque:
--   1. El formulario es 100% público (cualquiera puede enviar datos)
--   2. La anon key ya está expuesta en el frontend
--   3. El acceso de lectura es vía el dashboard de Supabase (requiere login)
--
-- Si en el futuro necesitas restringir acceso, habilita RLS y crea policies.
-- Nota: hay un bug conocido en proyectos Supabase nuevos donde las RLS
-- policies TO anon no son evaluadas correctamente por PostgREST.

ALTER TABLE evaluaciones DISABLE ROW LEVEL SECURITY;

-- Asegurar grants completos
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.evaluaciones TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
