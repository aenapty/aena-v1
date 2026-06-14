# 📋 AENA Smart Business Control — Master Reference

> **Metodología:** Al iniciar cada sesión, Claude debe leer este archivo primero.
> Al finalizar cada sesión, Claude debe actualizar este archivo con los cambios realizados.

---

## 🔗 Accesos y URLs

| Recurso | URL |
|---|---|
| **Repo GitHub** | https://github.com/aenapty/aena-v1 |
| **Deploy Vercel** | https://aena-v1.vercel.app |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/dqobxvvpzzngljwdalnq |
| **Supabase URL** | https://dqobxvvpzzngljwdalnq.supabase.co |

> ⚠️ Las claves privadas (GitHub PAT, Supabase Service Key) se proporcionan en el chat inicial, NO se almacenan aquí.

---

## 🏗️ Stack Técnico

- **Frontend:** HTML + JavaScript vanilla (sin frameworks)
- **Backend:** Supabase JS SDK vía CDN
- **Auth:** Supabase Auth (usuarios con `auth.uid()`)
- **Deploy:** Vercel (auto-deploy desde branch `main` de GitHub)
- **PWA:** Sí — manifest dinámico con logo base64 en `index.html`

---

## 📁 Estructura del Repo

```
aena-v1/
├── index.html          # App principal (~5000 líneas) — Panel de admin/usuario
├── supervisor.html     # Panel de aprobación de solicitudes RRHH (vía token único)
├── solicitud.html      # Formulario que llena el colaborador
├── api/                # Carpeta de funciones API (Vercel)
├── netlify/functions/  # Funciones legacy (no en uso activo)
└── MASTER_REFERENCE.md # Este archivo
```

---

## 🗄️ Base de Datos — Supabase

### Tablas y propósito

| Tabla | Propósito |
|---|---|
| `clientes` | Empresas/tenants. Cada registro es un cliente de AENA |
| `usuarios` | Usuarios autenticados (auth.uid()) |
| `colaboradores` | Empleados de cada cliente |
| `supervisores` | Supervisores de cada cliente (para aprobación de RRHH) |
| `cliente_modulos` | Módulos activos por cliente (multimodular) |
| `invitaciones` | Tokens de invitación para onboarding |
| `movimientos_rrhh` | Registro final de vacaciones, incapacidades, permisos |
| `solicitud_tokens` | Flujo de aprobación RRHH (token único por solicitud) |
| `reposiciones_permiso` | Horas de reposición de permisos |
| `tipos_permiso_config` | Configuración de tipos de permiso por cliente |
| `facturas` | Gastos/compras del módulo financiero |
| `ingresos` | Ingresos mensuales del módulo financiero |
| `clasificaciones_gasto` | Categorías de gasto (ej: Combustible, Servicios Básicos) |
| `proveedores` | Proveedores del módulo financiero |

### Columnas clave de `clasificaciones_gasto`
```
id, cliente_id, nombre, modulo, activo, created_at
```
> 🔜 PENDIENTE: Agregar `numero_cuenta` (text) y `tipo_cuenta` (text)

### Columnas clave de `movimientos_rrhh`
```
id, cliente_id, colaborador_id, tipo (vacacion|incapacidad|permiso),
subtipo, fecha_inicio, fecha_fin, dias, horas_extra, total_horas,
anio_ciclo, horas_repuestas, entidad_emisora, numero_documento,
descripcion, estado, created_at
```

### Columnas clave de `solicitud_tokens`
```
id, cliente_id, colaborador_id, supervisor_id, tipo_movimiento,
estado (pendiente_empleado|pendiente_supervisor|aprobado|rechazado|modificado|expirado),
token_supervisor, datos_solicitud (jsonb), datos_modificados (jsonb),
datos_aprobados (jsonb), movimiento_id, notas_empleado, notas_supervisor,
empleado_envio_at, supervisor_abrio_at, supervisor_accion_at,
supervisor_ip, supervisor_user_agent, created_at
```

---

## 🔐 RLS (Row Level Security)

### Patrón general
```sql
-- La mayoría de tablas siguen este patrón:
SELECT: es_super_admin() OR cliente_id = get_cliente_id()
INSERT: null (permite anon — controlado por la app)
UPDATE: es_super_admin() OR cliente_id = get_cliente_id()
DELETE: es_super_admin() OR cliente_id = get_cliente_id()
```

### Tablas con lectura pública (SELECT = true)
- `clientes`, `colaboradores`, `supervisores`, `tipos_permiso_config`

### ⚠️ Inconsistencia detectada
Algunas tablas usan `es_super_admin()` / `get_cliente_id()` y otras usan
`is_super_admin()` / `get_my_cliente_id()`. Son funciones equivalentes pero con
nombres distintos. Pendiente unificar en una futura limpieza.

### Tablas especiales
- `solicitud_tokens`: tiene política UPDATE pública (para que supervisores puedan actualizar sin auth)
- `invitaciones`: solo admin

---

## 🧩 Módulos de la App

### Módulo RRHH ✅ Completo
**Flujo de solicitud:**
1. Admin crea solicitud en `index.html` → se genera token único en `solicitud_tokens`
2. Colaborador recibe link a `solicitud.html` → llena sus datos → estado pasa a `pendiente_supervisor`
3. Supervisor recibe link a `supervisor.html?token=XXX` → Aprueba / Modifica / Rechaza
4. Si aprueba → se inserta en `movimientos_rrhh` automáticamente

**Tipos de movimiento:** `vacacion`, `incapacidad`, `permiso`

**Subtipos de permiso:** configurables por cliente en `tipos_permiso_config`
- Campos: goce_salario, reposicion (boolean), nombre_tipo_permiso

### Módulo Financiero 🔧 En mejora
**Estado actual:**
- Registro de facturas con: proveedor, fecha, monto, ITBMS, retención, clasificación
- Registro de ingresos mensuales (gravable, exento, ITBMS cobrado, retenciones)
- Clasificaciones de gasto por nombre (ej: Combustible, Servicios Básicos)
- Gestión de proveedores con RUC y DV

**Reportes actuales (NO TOCAR):**
- Los reportes existentes deben mantenerse intactos

**🔜 MEJORAS PENDIENTES — MÓDULO CONTABLE:**
Ver sección "Trabajo Pendiente" más abajo.

### Módulo Base (todos los clientes)
- Multi-tenant por `cliente_id`
- Módulos activables por cliente en `cliente_modulos`
- Onboarding por invitación (token en `invitaciones`)

---

## 🔜 Trabajo Pendiente

### PRIORIDAD ALTA — Módulo Contable Básico

El módulo financiero necesita evolucionar a un sistema contable básico.
Los clientes AENA existentes NO se tocan. Esta mejora es para nuevos clientes.

**1. Ampliar `clasificaciones_gasto`**
```sql
ALTER TABLE clasificaciones_gasto ADD COLUMN numero_cuenta TEXT;
ALTER TABLE clasificaciones_gasto ADD COLUMN tipo_cuenta TEXT DEFAULT 'gasto';
-- tipo_cuenta values: activo | pasivo | patrimonio | ingreso | gasto
```

**2. Nuevas tablas por confirmar**
- Posible `categorias_ingreso` con numero_cuenta (para el lado de ingresos)
- Posible `cuentas_contables` (plan de cuentas maestro)

**3. Nuevos reportes a crear**
- **Mayor General** — transacciones por cuenta en orden de fecha
- **Balance General** — posición financiera (pendiente definir alcance con usuario)

**4. Preguntas pendientes de respuesta del usuario:**
- ¿Plan de cuentas estándar de Panamá o libre?
- ¿Balance General completo (activos/pasivos/patrimonio) o solo Estado de Resultados?
- ¿Mayor General solo lado gastos o también ingresos individuales?

---

## 📌 Decisiones de Arquitectura

1. **Sin frameworks** — todo vanilla JS para mantener simplicidad y evitar build steps
2. **Auto-deploy** — push a `main` en GitHub → Vercel despliega automáticamente (sin acción manual)
3. **Supabase como BaaS** — no hay backend propio, toda la lógica va en el cliente o en RLS
4. **Token único por solicitud RRHH** — no requiere auth del supervisor, solo el link con token
5. **PWA** — la app se puede instalar en móvil (manifest + service worker)

---

## 🔄 Metodología de Trabajo

### Al iniciar un chat:
1. El usuario pega el "Chat Inicial" con claves y contexto
2. Claude lee este MASTER_REFERENCE.md desde GitHub
3. Claude confirma qué tiene mapeado y pregunta por la tarea del día

### Al finalizar un chat:
1. Claude actualiza este MASTER_REFERENCE.md con:
   - Cambios realizados en esa sesión
   - Nuevas tablas o columnas creadas
   - Trabajo pendiente actualizado
2. Claude hace push del archivo actualizado a GitHub
3. Claude genera el nuevo "Chat Inicial" para la próxima sesión

---

## 📝 Historial de Sesiones

### Sesión 1 — 2026-06-14
**Lo que se hizo:**
- Mapeo completo del proyecto (repo, Supabase, Vercel)
- Revisión de schema completo (14 tablas) y políticas RLS
- Configuración de GitHub Fine-grained PAT (solo repo aena-v1)
- Creación de este MASTER_REFERENCE.md
- Identificación de mejoras necesarias al módulo financiero (sistema contable básico)

**Pendiente definir con el usuario:**
- Alcance exacto del Balance General
- Tipo de plan de cuentas (estándar Panamá vs libre)
- Si el Mayor General incluye ingresos individuales o solo gastos

