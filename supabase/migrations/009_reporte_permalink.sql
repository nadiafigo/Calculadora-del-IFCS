-- 009_reporte_permalink.sql
-- Link permanente por evaluación: el reporte se vuelve a generar desde los
-- datos guardados, sin depender del localStorage del navegador que lo creó.
--
-- Contexto: varias personas preguntaron si el reporte podía "quedar en la
-- nube". En vez de guardar PDFs, cada evaluación recibe un token UUID
-- (imposible de adivinar) y resultado.html?r=<token> reconstruye el
-- diagnóstico, las propuestas y el PDF con los datos de la base. Así el
-- reporte siempre refleja la metodología vigente y no cuesta storage.
--
-- Idempotente: se puede re-aplicar sin efectos.

-- 1) Token público por evaluación -------------------------------------------
-- DEFAULT volátil: Postgres reescribe la tabla evaluando gen_random_uuid()
-- fila por fila, así que las evaluaciones existentes también reciben su
-- propio token (y por lo tanto su link) desde el admin.

ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluaciones_public_token
  ON evaluaciones(public_token);

-- 2) Respuestas crudas del formulario ----------------------------------------
-- Las columnas via_* / pte_* guardan el TEXTO de la opción elegida; el
-- diagnóstico se decide por el ID de la opción (ej. "ViaDistSemaf_99menos").
-- Guardamos {campo: {id, txt, val}} para regenerar sin heurísticas. Las filas
-- anteriores a esta migración no lo tienen: resultado.js reconstruye los ids
-- a partir del texto usando las opciones de index.html.

ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS respuestas JSONB;

-- 3) Lectura pública por token -------------------------------------------------
-- anon solo puede SELECT filas aprobadas (007). Una evaluación recién enviada
-- todavía no está aprobada, así que el link se resuelve con una función
-- SECURITY DEFINER que exige el token exacto. Sin token no hay forma de
-- enumerar filas (el id secuencial no sirve de entrada).

CREATE OR REPLACE FUNCTION public.get_evaluacion_publica(token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(e) - 'aprobado_por'
  FROM public.evaluaciones e
  WHERE e.public_token = token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_evaluacion_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evaluacion_publica(uuid) TO anon, authenticated;

-- 4) Recargar cache de esquema de PostgREST ----------------------------------

NOTIFY pgrst, 'reload schema';
