-- 010_permisos_admin_y_aprobacion.sql
-- Cierra tres huecos que encontró la auditoría del 10/11/2026:
--
--   1) La aprobación se podía saltar: la policy `public_insert` (007) era
--      WITH CHECK (true) y anon tenía GRANT ALL (003/005), así que cualquiera
--      con la anon key podía insertar una fila ya aprobada o "Retirada".
--   2) Cualquier usuario autenticado del proyecto podía leer, editar y borrar
--      evaluaciones. El proyecto Supabase (`tnlxfzruypugbttafeyf`) se comparte
--      con el sitio de Cuervo Café, que tiene sus propios usuarios.
--   3) `get_evaluacion_publica(token)` devolvía `fuente_correo`.
--
-- No toca la lectura anónima de filas aprobadas (el mapa, estadísticas y el
-- archivo siguen igual). El GRANT por columnas que oculta `fuente_correo` a
-- anon va aparte, en 011, porque rompe `select=*` del frontend viejo.
--
-- Idempotente: se puede re-aplicar sin efectos.

-- 1) Lista de admins del panel ----------------------------------------------
-- Correos en minúsculas. Nadie la lee por la API: sólo la consulta la
-- función SECURITY DEFINER de abajo.

CREATE TABLE IF NOT EXISTS public.ifcs_admins (
  email      text PRIMARY KEY CHECK (email = lower(email)),
  agregado_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ifcs_admins ENABLE ROW LEVEL SECURITY;
-- Los default privileges de Supabase dan ALL a anon/authenticated en tablas
-- nuevas de public; aquí se quitan.
REVOKE ALL ON TABLE public.ifcs_admins FROM PUBLIC, anon, authenticated;

-- El correo institucional del panel. Los correos personales de los demás
-- admins NO van en este archivo (el repo es público): se dan de alta a mano
-- con   INSERT INTO public.ifcs_admins(email) VALUES ('<correo>')
--       ON CONFLICT DO NOTHING;
-- y se dan de baja con DELETE. Ver BITACORA.md (10/11/2026).
INSERT INTO public.ifcs_admins(email)
VALUES ('adiospuentesantipeatonales@ligapeatonal.org')
ON CONFLICT (email) DO NOTHING;

-- 2) ¿El usuario de la sesión es admin de la calculadora? ---------------------

CREATE OR REPLACE FUNCTION public.es_admin_ifcs()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ifcs_admins a
    WHERE a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE ALL ON FUNCTION public.es_admin_ifcs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_admin_ifcs() TO authenticated;

-- 3) Privilegios de tabla -------------------------------------------------------
-- anon sólo necesita INSERT (formulario) y SELECT (mapa, filtrado por RLS).
-- TRUNCATE además se salta RLS, así que se le quita también a authenticated.

REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.evaluaciones FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.evaluaciones FROM authenticated;

-- 4) Policies -------------------------------------------------------------------

ALTER TABLE public.evaluaciones ENABLE ROW LEVEL SECURITY;

-- INSERT: el formulario público (anon) sólo puede crear filas pendientes.
-- `aprobado_mapa` es NOT NULL DEFAULT false: si no se manda, queda false.
DROP POLICY IF EXISTS "public_insert"     ON public.evaluaciones;  -- 007
DROP POLICY IF EXISTS "allow_anon_insert" ON public.evaluaciones;  -- 004
DROP POLICY IF EXISTS "insert_pendiente"  ON public.evaluaciones;
CREATE POLICY "insert_pendiente"
  ON public.evaluaciones FOR INSERT
  TO anon, authenticated
  WITH CHECK (
        aprobado_mapa = false
    AND aprobado_por  IS NULL
    AND aprobado_at   IS NULL
    AND status_retiro IS NULL
    AND fecha_retiro  IS NULL
  );

-- SELECT / UPDATE / DELETE de authenticated: sólo admins de la calculadora.
-- Las páginas públicas usan siempre la anon key, así que un usuario logueado
-- de Cuervo Café no pierde nada que use.
-- `(SELECT …)` hace que la función se evalúe una vez por consulta, no por fila.
DROP POLICY IF EXISTS "authenticated_select_all" ON public.evaluaciones;  -- 007
DROP POLICY IF EXISTS "authenticated_update_all" ON public.evaluaciones;  -- 007
DROP POLICY IF EXISTS "authenticated_delete_all" ON public.evaluaciones;  -- 007
DROP POLICY IF EXISTS "admin_select" ON public.evaluaciones;
DROP POLICY IF EXISTS "admin_update" ON public.evaluaciones;
DROP POLICY IF EXISTS "admin_delete" ON public.evaluaciones;

CREATE POLICY "admin_select"
  ON public.evaluaciones FOR SELECT TO authenticated
  USING ((SELECT public.es_admin_ifcs()));

CREATE POLICY "admin_update"
  ON public.evaluaciones FOR UPDATE TO authenticated
  USING ((SELECT public.es_admin_ifcs()))
  WITH CHECK ((SELECT public.es_admin_ifcs()));

CREATE POLICY "admin_delete"
  ON public.evaluaciones FOR DELETE TO authenticated
  USING ((SELECT public.es_admin_ifcs()));

-- `anon_select_approved_only` (007) se queda como está.

-- 5) Link permanente sin correo ----------------------------------------------
-- Misma firma, mismo SECURITY DEFINER y mismo comportamiento (resuelve el
-- token aunque la fila no esté aprobada); sólo deja fuera `fuente_correo`.
-- `fuente_nombre` y `fuente_org` se quedan: el consentimiento del formulario
-- cubre nombre y colectivo.

CREATE OR REPLACE FUNCTION public.get_evaluacion_publica(token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(e) - 'aprobado_por' - 'fuente_correo'
  FROM public.evaluaciones e
  WHERE e.public_token = token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_evaluacion_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evaluacion_publica(uuid) TO anon, authenticated;

-- 6) Recargar cache de esquema de PostgREST ----------------------------------

NOTIFY pgrst, 'reload schema';
