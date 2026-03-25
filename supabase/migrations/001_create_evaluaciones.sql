-- Tabla principal: cada fila es una evaluación de un puente antipeatonal
CREATE TABLE IF NOT EXISTS evaluaciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Sección 1: Ubicación
  loc_pais TEXT,
  loc_ciudad TEXT,
  loc_vialidad TEXT,
  loc_colonia TEXT,
  loc_referencia TEXT,
  loc_x TEXT,
  loc_y TEXT,

  -- Sección 2: Vialidad
  via_carriles TEXT,
  via_dist_cruce TEXT,
  via_dist_semaf TEXT,
  via_barreras TEXT,
  via_camellones TEXT,
  via_revo TEXT,
  via_revo_tipo TEXT,
  via_vel_permi TEXT,
  via_vel_oper TEXT,

  -- Sección 3: Equipamientos
  equip_num TEXT,
  equip_dist TEXT,
  equip_tipo TEXT,

  -- Sección 4: Puente
  pte_obst_banq TEXT,
  pte_ancho_acc TEXT,
  pte_tipo_acc TEXT,
  pte_num_esc TEXT,
  pte_long_cami TEXT,
  pte_pendiente TEXT,
  pte_dist_desc TEXT,
  pte_ancho_pas TEXT,
  pte_cubierta TEXT,
  pte_iluminacion TEXT,
  pte_publi TEXT,
  pte_publi_visib TEXT,

  -- Sección 5: Fuente
  fuente_nombre TEXT,
  fuente_fecha DATE,
  fuente_org TEXT,
  fuente_correo TEXT,

  -- Resultado calculado
  total_ifcs INTEGER,
  factibilidad TEXT CHECK (factibilidad IN ('Corto plazo', 'Mediano plazo', 'Largo plazo'))
);

-- Índices para consultas comunes
CREATE INDEX IF NOT EXISTS idx_evaluaciones_ciudad ON evaluaciones(loc_ciudad);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_factibilidad ON evaluaciones(factibilidad);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_created ON evaluaciones(created_at DESC);

-- RLS: habilitar pero permitir INSERT anónimo (el formulario es público)
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar (formulario público)
CREATE POLICY "Permitir inserts anónimos"
  ON evaluaciones FOR INSERT
  TO anon
  WITH CHECK (true);

-- Solo usuarios autenticados pueden leer (Nadia y equipo con el dashboard de Supabase)
CREATE POLICY "Solo autenticados leen"
  ON evaluaciones FOR SELECT
  TO authenticated
  USING (true);

-- Para que el dashboard público funcione eventualmente, agregar lectura anónima también
-- (descomentar cuando quieran un mapa/dashboard público)
-- CREATE POLICY "Lectura pública" ON evaluaciones FOR SELECT TO anon USING (true);
