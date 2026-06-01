-- ============================================================
-- SCHEMA TRUFA APP v2
-- operario_nombre: texto libre (histórico + nuevos registros)
-- operario_id: UUID opcional, solo cuando hay usuario logado
-- ============================================================

CREATE TABLE fincas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parcelas (
  id SERIAL PRIMARY KEY,
  finca_id INTEGER REFERENCES fincas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE perros (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operario')),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recolecciones:
-- operario_nombre: siempre presente (texto)
-- operario_id: solo cuando viene de un usuario autenticado (puede ser NULL en histórico)
CREATE TABLE recolecciones (
  id SERIAL PRIMARY KEY,
  finca_id INTEGER REFERENCES fincas(id),
  parcela_id INTEGER REFERENCES parcelas(id),
  operario_id UUID REFERENCES auth.users(id),   -- NULL en datos históricos
  operario_nombre TEXT NOT NULL,                 -- siempre presente
  perro_id INTEGER REFERENCES perros(id),
  perro_nombre TEXT,                             -- texto libre para histórico
  peso_kg NUMERIC(8,3) NOT NULL CHECK (peso_kg >= 0),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE recolecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE fincas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perros ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fincas_read" ON fincas FOR SELECT TO authenticated USING (true);
CREATE POLICY "parcelas_read" ON parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "perros_read" ON perros FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_own" ON user_roles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Operarios: insertan sus propios registros (operario_id = su UUID)
CREATE POLICY "recolecciones_insert" ON recolecciones FOR INSERT TO authenticated
  WITH CHECK (operario_id = auth.uid());

-- Lectura: cada operario ve los suyos (por UUID o por nombre); admins ven todo
CREATE POLICY "recolecciones_read" ON recolecciones FOR SELECT TO authenticated
  USING (
    operario_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_manage_fincas" ON fincas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_manage_parcelas" ON parcelas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_manage_perros" ON perros FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_manage_roles" ON user_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'));
