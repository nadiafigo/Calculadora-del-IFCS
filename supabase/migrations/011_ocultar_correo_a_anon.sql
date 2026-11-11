-- 011_ocultar_correo_a_anon.sql
-- anon deja de poder leer `fuente_correo` de la tabla `evaluaciones`.
-- Sigue leyendo todas las demás columnas de las filas aprobadas (RLS de 007),
-- incluidas `fuente_nombre` y `fuente_org`.
--
-- ⚠ APLICAR SÓLO DESPUÉS de publicar el frontend que pide columnas
-- explícitas (mapa.js / analytics.js sin `select=*`). Con privilegios por
-- columna, `select=*` de anon falla con "permission denied" y el mapa y las
-- estadísticas se quedarían vacíos.
--
-- Cómo funciona: se quita el SELECT a nivel tabla (eso también quita los
-- privilegios de columna que hubiera) y se da SELECT columna por columna a
-- todas menos `fuente_correo`. La lista se arma del catálogo, así que una
-- columna nueva queda legible si se vuelve a correr esta migración.
--
-- Idempotente: se puede re-aplicar sin efectos.
-- Para deshacerla:  GRANT SELECT ON TABLE public.evaluaciones TO anon;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO cols
    FROM pg_attribute
   WHERE attrelid = 'public.evaluaciones'::regclass
     AND attnum > 0
     AND NOT attisdropped
     AND attname <> 'fuente_correo';

  EXECUTE 'REVOKE SELECT ON TABLE public.evaluaciones FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON TABLE public.evaluaciones TO anon', cols);
END $$;

NOTIFY pgrst, 'reload schema';
