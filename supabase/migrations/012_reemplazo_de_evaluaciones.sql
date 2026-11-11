-- 012_reemplazo_de_evaluaciones.sql
-- Un puente cuyo entorno cambió se vuelve a evaluar y la evaluación nueva
-- reemplaza a la anterior (decisión de Nadia, 11/11/2026): en el archivo, el
-- mapa y las estadísticas sólo sale la vigente, sin varias fichas por puente.
--
-- `reemplazada_por` vive en la fila VIEJA y apunta a la nueva. La marca el
-- admin desde el panel. Si la nueva se borra, la vieja vuelve a salir sola
-- (ON DELETE SET NULL). El link permanente de la vieja sigue abriendo su
-- reporte, con un aviso que lleva a la evaluación vigente.
--
-- Orden de despliegue: esta migración ANTES del frontend que filtra por
-- `reemplazada_por=is.null` (sin el GRANT de abajo, anon recibiría 401).
-- El frontend anterior no se entera de la columna.
--
-- Idempotente: se puede re-aplicar sin efectos.
-- Para deshacerla:
--   ALTER TABLE public.evaluaciones DROP COLUMN reemplazada_por;
--   y volver a correr la sección 5 de la 010 (get_evaluacion_publica).

-- 1) Columna -------------------------------------------------------------------

ALTER TABLE public.evaluaciones
  ADD COLUMN IF NOT EXISTS reemplazada_por bigint
    REFERENCES public.evaluaciones(id) ON DELETE SET NULL;

ALTER TABLE public.evaluaciones
  DROP CONSTRAINT IF EXISTS evaluaciones_no_se_reemplaza_a_si_misma;
ALTER TABLE public.evaluaciones
  ADD CONSTRAINT evaluaciones_no_se_reemplaza_a_si_misma
    CHECK (reemplazada_por IS NULL OR reemplazada_por <> id);

CREATE INDEX IF NOT EXISTS evaluaciones_reemplazada_por_idx
  ON public.evaluaciones (reemplazada_por)
  WHERE reemplazada_por IS NOT NULL;

-- 2) anon puede leerla (011 dejó el SELECT de anon columna por columna) -------

GRANT SELECT (reemplazada_por) ON TABLE public.evaluaciones TO anon;

-- 3) El formulario público no puede marcar reemplazos --------------------------
-- Misma policy de la 010 más la columna nueva.

DROP POLICY IF EXISTS "insert_pendiente" ON public.evaluaciones;
CREATE POLICY "insert_pendiente"
  ON public.evaluaciones FOR INSERT
  TO anon, authenticated
  WITH CHECK (
        aprobado_mapa   = false
    AND aprobado_por    IS NULL
    AND aprobado_at     IS NULL
    AND status_retiro   IS NULL
    AND fecha_retiro    IS NULL
    AND reemplazada_por IS NULL
  );

-- 4) Link permanente: avisa si hay una evaluación más reciente -----------------
-- Igual que en la 010, más `reemplazo_token`: el token público de la
-- evaluación vigente, sólo si ya está aprobada (null en cualquier otro caso).

CREATE OR REPLACE FUNCTION public.get_evaluacion_publica(token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (to_jsonb(e) - 'aprobado_por' - 'fuente_correo')
         || jsonb_build_object(
              'reemplazo_token',
              (SELECT n.public_token
                 FROM public.evaluaciones n
                WHERE n.id = e.reemplazada_por
                  AND n.aprobado_mapa = true)
            )
  FROM public.evaluaciones e
  WHERE e.public_token = token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_evaluacion_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evaluacion_publica(uuid) TO anon, authenticated;

-- 5) Recargar cache de esquema de PostgREST -----------------------------------

NOTIFY pgrst, 'reload schema';
