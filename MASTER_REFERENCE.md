# 📋 AENA Smart Business Control — Master Reference

> **Metodología:** Al iniciar cada sesión, Claude debe leer este archivo primero.
> Al finalizar cada sesión, Claude debe actualizar este archivo y hacer push.
> **Las claves privadas NO se guardan aquí** — van en el "Chat Inicial".

---

## 🔗 Accesos y URLs

| Recurso | URL |
|---|---|
| **Repo GitHub** | https://github.com/aenapty/aena-v1 |
| **Deploy Vercel** | https://aena-v1.vercel.app |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/dqobxvvpzzngljwdalnq |
| **Supabase URL** | https://dqobxvvpzzngljwdalnq.supabase.co |
| **Supabase anon/publishable key** | `sb_publishable_rCbSAjOlexErR9WBN-rfZA_8Tadpfa0` (pública, ya va en `index.html`) |

> ⚠️ El **GitHub PAT** y el **Supabase Service Role Key (legacy)** son privados.
> El PAT se entrega en el Chat Inicial. El Service Role Key vive **solo** como variable
> de entorno en Vercel (`SUPABASE_SERVICE_ROLE_KEY`), nunca en el repo ni en el cliente.

---

## 🏗️ Stack Técnico

- **Frontend:** HTML + JavaScript vanilla (sin frameworks, sin build step)
- **Backend:** Supabase JS SDK vía CDN
- **Auth:** Supabase Auth — tabla `usuarios` keyed por `auth.uid()`, con `rol` (`super_admin`/`admin`) y `cliente_id`
- **Serverless:** Vercel Functions en `/api` (Node)
- **Deploy:** Vercel — auto-deploy al hacer push a `main`
- **PWA:** Sí — manifest dinámico con logo base64 en `index.html`

> 🛠️ **Limitación del entorno de Claude:** la terminal (bash) **NO** puede alcanzar
> `*.supabase.co` ni `*.vercel.app` (solo github/npm/pypi). Por eso:
> - El SQL lo corre **el usuario** en el SQL Editor de Supabase (Claude se lo entrega listo).
> - Claude edita `index.html`, valida el JS (`node --check`), commitea y hace `git push`.
> - No se puede probar endpoints ni queries desde bash; se prueba en la app desplegada.

---

## 📁 Estructura del Repo

```
aena-v1/
├── index.html              # App principal (~5700+ líneas) — admin/usuario, todos los módulos
├── supervisor.html         # Panel de aprobación RRHH (vía token único)
├── solicitud.html          # Formulario que llena el colaborador (RRHH)
├── api/
│   ├── create-client.js    # Crea cliente en 1 paso (Auth user + cliente + módulos + plan)
│   └── send-email.js       # Envío de correos
├── netlify/functions/      # Legacy (no en uso activo)
└── MASTER_REFERENCE.md     # Este archivo
```

**Flujo de trabajo de Claude:** editar `index.html` → validar JS → `git commit` → `git push origin main` → Vercel despliega. Avisar al usuario que refresque (F5) tras ~1 min.

---

## 🗄️ Base de Datos — Supabase

### Tablas núcleo / RRHH
| Tabla | Propósito |
|---|---|
| `clientes` | Empresas/tenants |
| `usuarios` | Usuarios autenticados (`auth.uid()`), `rol`, `cliente_id`, `email`, `nombre` |
| `cliente_modulos` | Módulos activos por cliente (multimodular) |
| `colaboradores` / `supervisores` | Empleados y supervisores por cliente |
| `solicitud_tokens` | Flujo de aprobación RRHH (token único por solicitud) |
| `movimientos_rrhh` | Registro final: vacaciones, incapacidades, permisos |
| `tipos_permiso_config`, `reposiciones_permiso`, `invitaciones` | Config y onboarding |

### Tablas financieras / ITBMS / ISR
| Tabla | Propósito |
|---|---|
| `facturas` | Facturas de **compra**/gastos. **1 fila por línea** (no hay tabla cabecera) |
| `ingresos` | Ingresos mensuales agregados (gravable, exento, ITBMS cobrado, retenciones) |
| `clasificaciones_gasto` | Categorías de gasto por nombre |
| `proveedores` | id, cliente_id, nombre, ruc, dv, activo |

**`facturas` (columnas relevantes):** `cliente_id, modulo, anio, mes, fecha_exacta, proveedor, ruc_proveedor, dv, concepto, detalle, numero_factura, clasificacion_id, monto_gravable, monto_exento, itbms_calculado, itbms_factura, retencion, tipo` **+ `cuenta_id` (→cuentas_contables) + `asiento_id` (→asientos)**.

### Tablas del MÓDULO CONTABLE (nuevas — sesión 2)
Archivo SQL aplicado: `01_modulo_contable.sql` (se generó en outputs; el usuario ya lo corrió).

| Tabla | Columnas clave |
|---|---|
| `cuentas_contables` | `id, cliente_id, numero_cuenta, nombre, tipo`(activo/pasivo/patrimonio/ingreso/costo/gasto)`, naturaleza`(deudora/acreedora)`, nivel, es_movimiento, cuenta_padre_id, activo, es_itbms`(bool) |
| `asientos` | `id, cliente_id, numero`(correlativo auto vía trigger)`, fecha, descripcion, referencia, proveedor_id, tipo`(manual/factura)`, origen_tabla, origen_id, estado` |
| `asiento_lineas` | `asiento_id`(**ON DELETE CASCADE**)`, cliente_id, cuenta_id, proveedor_id, descripcion, debe, haber, orden` |
| `facturas_ingreso` | facturas de **venta** una por una: `cliente_id, modulo, fecha, anio, mes, numero_documento, cliente_nombre, ruc_cliente, dv, concepto, cuenta_ingreso_id, monto_gravable, monto_exento, itbms*, retencion` |

**Función:** `seed_plan_cuentas(p_cliente_id uuid)` — siembra plan estándar Panamá:
1101 Caja, 1102 Banco, 1103 CxC, 1104 Inventario, 2101 CxP Proveedores, **2102 ITBMS por Pagar (`es_itbms=true`)**, 2103 Retenciones por Pagar, 2104 Impuestos por Pagar, 2105 Gastos Acumulados, 3101 Capital, 4101 Ingresos, 5101 Costo de Ventas, 6101–6107 Gastos. (La función termina con un `UPDATE … es_itbms=true WHERE numero_cuenta='2102'`.)

**Cuenta ITBMS — UNA SOLA (sesión 3):** Todo el ITBMS vive en **2102 ITBMS por Pagar** (`es_itbms=true`, pasivo/acreedora). **Compras → Debe** (crédito fiscal, baja lo que se debe); **Ventas → Haber** (lo que se cobra y se debe a la DGI). El **saldo neto de la 2102** = posición ante la DGI. La vieja **1105 "ITBMS Pagado"** quedó **desmarcada e inactiva** (`es_itbms=false, activo=false`); no se borró por integridad referencial. El código solo busca la cuenta con `es_itbms=true` (sin fallback a 1105).

---

## 🔐 RLS (Row Level Security)

Patrón general en casi todas las tablas:
```sql
SELECT/UPDATE/DELETE: es_super_admin() OR cliente_id = get_cliente_id()
INSERT: controlado por la app
```
Las tablas contables (`cuentas_contables`, `asientos`, `asiento_lineas`, `facturas_ingreso`) llevan el mismo patrón por `cliente_id`.

> ⚠️ Inconsistencia histórica: conviven `es_super_admin()`/`get_cliente_id()` con
> `is_super_admin()`/`get_my_cliente_id()`. Equivalentes; pendiente unificar.

---

## 🧩 Módulos de la App

`moduloActivo` global: `itbms` | `isr` | `rrhh` | `contable`. `detectModulo()` (async) resuelve los módulos del cliente desde `cliente_modulos`; para super_admin trae los reales. `switchModulo(m)` cambia sin cerrar sesión. UUIDs demo: `33333333…`=rrhh, `22222222…`=isr.

### RRHH ✅
Solicitud → token → colaborador llena (`solicitud.html`) → supervisor aprueba (`supervisor.html?token=`) → inserta en `movimientos_rrhh`. Tipos: `vacacion`, `incapacidad`, `permiso`.

### ITBMS / ISR ✅
Facturas de compra (1 fila/línea), ingresos mensuales, análisis y reportes ITBMS. Clientes reales: **Arenas & Barletta** (RRHH), **Dra. M.C. Lemm** (ITBMS), **Administradora** (ISR personal). NO romper.

### CONTABLE ✅ (construido en sesión 2)
Es un **módulo dentro de `index.html`** (no archivo aparte), aditivo y gateado por `moduloActivo==='contable'`. Incluye:
- **Plan de cuentas** (CRUD): `renderPlanCuentas`, `abrirNuevaCuenta`/`abrirEdicionCuenta`/`guardarCuenta`/`eliminarCuenta` (modal `modal-cuenta`, con flag `es_itbms`).
- **Asientos** (libro diario, partida doble): `renderAsientos`, `abrirNuevoAsiento`, editor debe/haber con validación de cuadre (`modal-asiento`), `eliminarAsiento`.
- **Facturas de ingreso** (ventas): `renderFacturasIngreso`, `abrirNuevaFacIng`, `guardarFacturaIngreso` (`modal-factura-ingreso`). **Genera asiento automático al guardar** (sesión 3): Debe **CxC (1103)** por el total; Haber **cuenta de ingreso** elegida (gravable+exento); Haber **ITBMS 2102** por el ITBMS cobrado. Liga `facturas_ingreso.id` vía `asientos.origen_tabla='facturas_ingreso'`. Hoy solo **alta** (sin edición todavía).
- **Factura de compra** con selector de **cuenta contable** por línea + "¿Cómo se pagó? (contrapartida)" → genera **asiento de partida doble** automático (`generarAsientoCompra`): debita gasto(s) + **ITBMS a la cuenta 2102** (Debe), acredita la contrapartida (Caja/Banco/CxP). Liga `facturas.asiento_id` y `asientos.origen_id`.
- **Reportes** derivados de `asientos`: **Mayor General** (`renderMayor`), **Balance General** (`renderBalance`), **Estado de Resultados** (`renderResultados`) — vía `movimientosContables()`/`saldosPorCuenta()`, filtrables por fecha.

---

## 🪟 Sistema de Ventanas / Pestañas (UI)

Diseño tipo "escritorio" para no bloquear el sistema al abrir formularios.

- **Paneles acoplados no bloqueantes:** clase CSS `.win-docked` (overlay con `pointer-events:none`, panel a la derecha con `pointer-events:auto`) → el menú izquierdo siempre queda usable. Aplica a `modal-factura`, `modal-asiento`, `modal-factura-ingreso`.
- **Botón minimizar** (`.win-minbtn` "–") en cada panel.
- **Barra de ventanas (taskbar)** `#win-tray`: `winOpen{}`, `winActivo`, `abrirVentana`/`minimizarVentana`/`restaurarVentana`/`cerrarVentana`/`renderWinTray`. Solo se muestra un panel a la vez; los demás quedan minimizados en la barra inferior.
- **Pestañas de facturas (varias a la vez):** `facturaTabs[]`, modelo de snapshots (`snapshotFacturaForm`/`restoreFacturaForm`), `abrirTabFactura`/`activarFacturaTab`/`cerrarFacturaTab`/`renderFacturaTabs`. `abrirEdicionFactura(id)` es un wrapper → `abrirTabFactura(id)`; el cuerpo de edición es `cargarFacturaEnForm(id)`.
- **Estado por cliente+módulo:** `winStore{}` keyed por `ctxKey(cid,mod)`. `capturarEstadoVentanas()` y `restaurarEstadoVentanas()` se llaman en `cambiarCliente` y `switchModulo`: al cambiar de cliente/módulo se guardan las ventanas del contexto y se muestran solo las del nuevo; al volver, reaparecen como estaban. Incluye snapshots de asiento (`snapshotAsientoForm`/`restoreAsientoForm`) y factura de ingreso (`snapshotFacIngForm`/`restoreFacIngForm`).
- Diálogos chicos (`modal-cuenta`, `modal-proveedor`) quedan como pop-up rápido centrado (no acoplados), para usarse encima de un formulario (ej. "+ Agregar cuenta" desde la factura).

---

## ✅ Reglas de Integridad (críticas)

1. **No duplicar número de factura de compra:** `numeroFacturaDuplicado()` bloquea al guardar; distingue **alta vs edición** vía `facturaEditandoId` (no se marca a sí misma).
2. **No duplicar número de documento** en facturas de ingreso (`guardarFacturaIngreso`).
3. **Borrado en cascada:** `eliminarFacturaYAsiento(id)` borra todas las filas de esa factura (comparten `asiento_id`) **y** su asiento (líneas en cascada) → limpia Mayor/Balance/Resultados. Usado en `eliminarFactura`, `eliminarFacturaDesdeEdicion`, `eliminarFacturaDesdeEdicion2`.
4. **Eliminar asiento** desvincula antes las facturas (`asiento_id=null`) para no chocar con el FK.
5. **Editar factura regenera su asiento:** `guardarEdicionFacturaDesdeModal` borra el asiento viejo y vuelve a llamar `generarAsientoCompra` con los montos nuevos. `cargarFacturaEnForm` **precarga la contrapartida** desde la línea `haber` del asiento vinculado.
6. **UX de guardado:** al guardar (alta o edición) el formulario se limpia y la pestaña queda lista para el siguiente registro, con toast `✓ guardado` (`resetTabFacturaActual` + `flashGuardado`). Evita doble clic / duplicados.
7. **Totales en vivo:** `updateTotalItbms()` recalcula subtotal/ITBMS/total al escribir en gravable, **exento** e ITBMS.
8. **Lista de facturas** muestra columnas: FECHA, N° FACTURA, PROVEEDOR, CONCEPTO, CUENTA/CLASIF, GRAVABLE, **EXENTO**, ITBMS, **TOTAL**, TIPO + KPIs (Gravable/Exento/ITBMS/Total).

---

## 👤 Super Admin — Herramientas

- **Crear cliente en 1 paso:** `api/create-client.js` (usa `SUPABASE_SERVICE_ROLE_KEY` **legacy** como env var en Vercel; verifica que el llamante sea super_admin con la publishable key en `/auth/v1/user`). Frontend `guardarNuevoCliente()` con checkbox "AENA Contable" (siembra plan) y contraseña temporal opcional.
- **Gestión de clientes** (Configuración): "Ver detalles" (`verDetalleCliente` → usuarios/correos/rol), "Administrar" (`administrarCliente`), "Editar".
- **Recuperar acceso:** el correo del super_admin se ve en Supabase → Authentication → Users (o tabla `usuarios`, `rol=super_admin`). La contraseña **no se puede recuperar** (encriptada); se restablece desde "¿Olvidaste tu contraseña?" en el login o desde Supabase Auth.

---

## 🔜 Trabajo Pendiente

- **Probar a fondo** el estado de ventanas por cliente (que el contenido de asiento/factura de ingreso restaure bien al volver).
- Posible: hacer minimizables los diálogos chicos (cuenta/proveedor) si el usuario lo pide.
- **Editar facturas de ingreso:** hoy solo hay alta. Falta flujo de edición y que **regenere su asiento** al editar (como ya hace la factura de compra). ✅ El asiento automático *al guardar* (alta) ya quedó hecho en sesión 3.
- Limpieza de SQL: unificar funciones RLS (`es_super_admin` vs `is_super_admin`).
- Limpiar clientes de prueba sobrantes ("Cliente prueba - Contabilidad", demos) si ya no sirven.

---

## 📌 Decisiones de Arquitectura

1. Sin frameworks (vanilla JS, sin build).
2. Auto-deploy: push a `main` → Vercel.
3. Supabase como BaaS; lógica en cliente + RLS + funciones serverless puntuales.
4. Contable = módulo dentro de `index.html`, aditivo y gateado (un cliente puede tener contable + rrhh, etc.).
5. `facturas` = 1 fila por línea (sin tabla cabecera).
6. Token único por solicitud RRHH (supervisor sin auth).
7. Ventanas acopladas no bloqueantes + estado por cliente/módulo.

---

## 📝 Historial de Sesiones

### Sesión 1 — 2026-06-14
- Mapeo del proyecto (repo, Supabase, Vercel), schema (14 tablas) y RLS.
- Configuración del GitHub Fine-grained PAT (solo repo aena-v1).
- Creación de este MASTER_REFERENCE.md. Definición del alcance del módulo contable.

### Sesión 2 — 2026-06-15
**Construido (todo en `main`, en vivo):**
- **Módulo Contable completo:** SQL (`cuentas_contables`, `asientos`, `asiento_lineas`, `facturas_ingreso`, `seed_plan_cuentas`); plan de cuentas, asientos partida doble, facturas de compra con cuenta+contrapartida → asiento automático, facturas de ingreso, reportes Mayor/Balance/Estado de Resultados.
- **Crear cliente en 1 paso** (`api/create-client.js` + `SUPABASE_SERVICE_ROLE_KEY` legacy en Vercel) y herramientas de super admin (ver detalles / administrar).
- **Sistema de ventanas:** paneles acoplados no bloqueantes, pestañas de facturas (varias a la vez con snapshots), barra de ventanas con minimizar/restaurar, y **estado de ventanas por cliente+módulo** (`winStore`/`ctxKey`/`capturar`/`restaurar`).
- **Integridad:** bloqueo de duplicados (factura/documento, distinguiendo alta vs edición), borrado en cascada factura→asiento, eliminar asiento desvincula facturas, editar factura regenera su asiento, UX de guardado que limpia y queda listo, totales en vivo (incl. exento), columnas Exento/Total en la lista.

**Pendiente:** ver sección "Trabajo Pendiente".

### Sesión 3 — 2026-06-15
**ITBMS consolidado en una sola cuenta (pasivo 2102):**
- **Código (`index.html`, en `main`):**
  - `generarAsientoCompra` / edición de compra: el ITBMS ahora usa **solo** la cuenta `es_itbms=true` (se eliminó el fallback hardcoded a la 1105).
  - `guardarFacturaIngreso`: ahora **genera asiento automático** al guardar (Debe CxC 1103 · Haber cuenta de ingreso · Haber ITBMS 2102).
  - Corregido el texto de la alerta de ITBMS (mencionaba 2103; es 2102).
- **SQL (corrido por Amilkar en Supabase):**
  - Migración: líneas de asiento de la 1105 → 2102; `es_itbms` movido a la 2102; 1105 desactivada.
  - `seed_plan_cuentas` actualizada: quita la 1105 del plan y marca la 2102 como `es_itbms=true` (clientes nuevos nacen bien).
- **Resultado verificado:** 2102 `es_itbms=true, activo=true`; 1105 `es_itbms=false, activo=false`. Cliente afectado: `ab2450ae…` (único contable).
- **Lógica final:** Compras → Debe 2102 (crédito fiscal); Ventas → Haber 2102; saldo neto 2102 = posición ante la DGI.
