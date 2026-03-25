-- Asegurar permisos completos para anon (INSERT) y authenticated (SELECT)
GRANT ALL ON TABLE public.evaluaciones TO anon;
GRANT ALL ON TABLE public.evaluaciones TO authenticated;

-- Permiso en la secuencia del id (necesario para GENERATED ALWAYS AS IDENTITY)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Notificar a PostgREST que recargue su cache de schema
NOTIFY pgrst, 'reload schema';
