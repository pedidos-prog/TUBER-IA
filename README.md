# 🍄 Trufa App — Sistema de Gestión de Recolección

Aplicación web para gestionar la recolección de trufa en fincas y parcelas.
Desarrollada con **Next.js 14** + **Supabase**.

---

## Estructura del proyecto

```
trufa-app/
├── src/
│   ├── app/
│   │   ├── login/       → Página de login (operarios y admin)
│   │   ├── operario/    → Formulario de recolección
│   │   └── admin/       → Dashboard semanal de administración
│   └── lib/
│       ├── supabase.ts  → Cliente Supabase
│       └── season.ts    → Lógica de semanas de temporada
├── supabase-schema.sql  → Schema completo de base de datos
└── .env.local.example   → Variables de entorno necesarias
```

---

## 1. Configurar Supabase

### Crear proyecto
1. Ve a [supabase.com](https://supabase.com) y crea una cuenta/proyecto nuevo.
2. En el dashboard del proyecto, ve a **SQL Editor**.
3. Copia y ejecuta el contenido de `supabase-schema.sql`.

### Crear usuarios (operarios y admin)
En Supabase → **Authentication → Users → Add user**:

1. Crea el usuario con email y contraseña.
2. Copia el UUID del usuario creado.
3. En SQL Editor, ejecuta:
   ```sql
   -- Para un administrador:
   INSERT INTO user_roles (id, role, nombre)
   VALUES ('UUID-DEL-USUARIO', 'admin', 'Nombre Admin');

   -- Para un operario:
   INSERT INTO user_roles (id, role, nombre)
   VALUES ('UUID-DEL-USUARIO', 'operario', 'Nombre Operario');
   ```

### Personalizar fincas y parcelas
Por defecto se crean Finca 1-4 con parcelas A/B/C/D. Para cambiar nombres:
```sql
UPDATE fincas SET nombre = 'La Encina' WHERE id = 1;
UPDATE parcelas SET nombre = 'Cuadro Norte' WHERE finca_id = 1 AND nombre = 'Parcela A';
```

---

## 2. Configurar en local

```bash
# Clonar / entrar al directorio
cd trufa-app

# Instalar dependencias
npm install

# Crear fichero de entorno
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

Las credenciales las encontrarás en Supabase → **Settings → API**.

```bash
# Arrancar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 3. Funcionamiento

### Operarios
- Acceden a `/operario` (redirige automático tras login).
- Ven la fecha y hora en tiempo real (se registra automáticamente).
- Seleccionan: finca → parcela (filtrada) → perro → peso en kg.
- El usuario recordado guarda el email en localStorage.

### Administradores
- Acceden a `/admin`.
- Ven totales de la temporada completa (01/10/2026 – 01/06/2027).
- Panel lateral con todas las semanas de la temporada numeradas.
- La semana 1 es la semana ISO que contiene el 01/10/2026.
- Por cada semana: días que la componen (lunes a domingo).
- Resumen por parcela, por operario y por perro con kg y %.
- Listado detallado de todas las recolecciones de esa semana.

---

## 4. Despliegue en Vercel

```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Desde la raíz del proyecto
vercel

# Seguir las instrucciones del asistente
# - Linkear con tu cuenta Vercel
# - Añadir las variables de entorno cuando las pida
```

O también puedes conectar el repositorio GitHub directamente desde
[vercel.com](https://vercel.com) y añadir las variables de entorno en
el dashboard de Vercel → **Settings → Environment Variables**.

---

## 5. Temporada

La temporada configurada es **01/10/2026 → 01/06/2027**.
Para cambiarla, edita `src/lib/season.ts`:
```typescript
export const SEASON_START = new Date('2026-10-01');
export const SEASON_END = new Date('2027-06-01');
```

---

## Tecnologías

- **Next.js 14** — App Router, SSR
- **Supabase** — Auth, PostgreSQL, Row Level Security
- **date-fns** — Manejo de fechas y semanas ISO
- **TypeScript** — Tipado completo
