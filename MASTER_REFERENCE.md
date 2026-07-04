# 📋 AENA Smart Business Control — Master Reference

> **Metodología:** Al iniciar cada sesión, Claude debe leer este archivo primero.
> Al finalizar cada sesión, Claude debe actualizar este archivo y hacer push.
> **Las claves privadas NO se guardan aquí** — van en el "Chat Inicial".

---

## ⏰ NOTA DE HOY — 2026-07-04

- **8:30 am: reunión de Amilkar con Licda. Kiria Plaza** para mostrar avances y **darle acceso al sistema**.
- Durante la reunión, Claude actúa como **soporte técnico rápido**: respuestas **directas y cortas**, nada de explicaciones largas. Ir al grano para poder responder al instante.
- Kiria (`dbdd0bef-7230-417d-82f3-78f2acca45db`) ya quedó lista: plan de cuentas y proveedores clonados de Dra. Lemm, y su ITBMS de compras configurado como **gasto** (cuenta `5150 · Gasto ITBMS`).
- Para darle acceso: usar el modal **"✉ Invitar usuario"** (panel 👑 Gestión) → generar invitación con `cliente_ids` = Kiria → ella la acepta en `invitacion.html`.

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
- **Auth:** Supabase Auth — tabla `usuarios` keyed por `auth.uid()`, con `rol` (`super_admin`/`admin`) y `cliente_id` (nullable). **Multiempresa:** un usuario `admin` puede acceder a varias empresas vía `usuario_clientes` (en ese caso `cliente_id` queda null y manda la membresía)
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
├── index.html              # App principal (~6000+ líneas) — admin/usuario, todos los módulos
├── supervisor.html         # Panel de aprobación RRHH (vía token único)
├── solicitud.html          # Formulario que llena el colaborador (RRHH)
├── invitacion.html         # Página del invitado: onboarding multiempresa por enlace (sesión 4)
├── api/
│   ├── create-client.js    # Crea cliente en 1 paso (Auth user + cliente + módulos + plan)
│   ├── aceptar-invitacion.js # Acepta invitación: crea login+perfil+membresías (service role) (sesión 4)
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
| `usuario_clientes` | **(sesión 4)** Membresía multiempresa: `(usuario_id, cliente_id)`. Qué empresas puede ver un usuario no-super-admin |
| `invitaciones_usuario` | **(sesión 4)** Invitación por enlace: `token, cliente_ids uuid[], email`(opcional)`, rol, expira, usado, usado_por, usado_at` |

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

**Modelo multiempresa (sesión 4).** Función central:
```sql
tiene_acceso_cliente(p_cliente_id uuid) =
  es_super_admin()
  OR p_cliente_id = get_cliente_id()          -- caso viejo (1 usuario = 1 empresa), retrocompatible
  OR EXISTS (SELECT 1 FROM usuario_clientes WHERE usuario_id=auth.uid() AND cliente_id=p_cliente_id)
```

**Tablas financieras/fiscales** (facturas, ingresos, proveedores, clasificaciones_gasto, cuentas_contables, asientos, asiento_lineas, facturas_ingreso, SELECT de cliente_modulos) → todas usan `tiene_acceso_cliente(cliente_id)` para SELECT/INSERT/UPDATE/DELETE.

**Tablas RRHH** (colaboradores, movimientos_rrhh, supervisores, solicitud_tokens, reposiciones_permiso, tipos_permiso_config) → **siguen con el patrón viejo** `es_super_admin() OR cliente_id = get_cliente_id()` (o sus gemelas `is_super_admin`/`get_my_cliente_id`). **No se tocaron.**

**Helpers (4, dos pares equivalentes):** `es_super_admin()`=`is_super_admin()`; `get_cliente_id()`=`get_my_cliente_id()` (devuelven el `cliente_id` único del usuario). Pendiente unificar nombres algún día (no urgente).

`usuario_clientes` y `invitaciones_usuario`: RLS solo super_admin las gestiona (`es_super_admin()`); `usuario_clientes` además deja al propio usuario leer sus filas. El endpoint `aceptar-invitacion.js` usa **Service Role** y escribe por encima de RLS.

> ⚠️ **Pendiente de seguridad:** `clientes` tiene la política `clientes_public_read` (`USING true`) que deja **listar nombres** de todas las empresas a cualquier sesión (los datos financieros sí están protegidos uno por uno). Venía de antes. Cerrar en sesión aparte.

---

## 🧩 Módulos de la App

`moduloActivo` global: `itbms` | `isr` | `rrhh` | `contable`. `detectModulo()` (async) resuelve los módulos del cliente desde `cliente_modulos`; para super_admin **y para usuarios con >1 empresa** trae los reales por empresa activa. `switchModulo(m)` cambia sin cerrar sesión. UUIDs demo hardcoded en detectModulo: `33333333…`=rrhh, `22222222…`=isr.

**Multiempresa por usuario (sesión 4):** `loadUser` lee `usuario_clientes` para armar `todosClientes` (con fallback al `cliente_id` único si no hay membresías). El **selector de empresa** de arriba (mismo componente del super_admin) ahora se muestra para **cualquier usuario con >1 empresa** (label dinámico: "EMPRESA" para usuario normal, "CLIENTE" para super_admin). `cambiarCliente(id)` recarga todo el contexto + estado de ventanas.

### RRHH ✅
Solicitud → token → colaborador llena (`solicitud.html`) → supervisor aprueba (`supervisor.html?token=`) → inserta en `movimientos_rrhh`. Tipos: `vacacion`, `incapacidad`, `permiso`.

### ITBMS / ISR ✅
Facturas de compra (1 fila/línea), ingresos mensuales, análisis y reportes ITBMS.

**Concepto de GASTO unificado (`gastoDe(f)`) — sesión 6.** El "gasto" de una factura depende del módulo:
- **Contable:** es la **cuenta contable** de la factura (`cuentas.find(id===f.cuenta_id)` → `numero · nombre`). NO se usa `clasificaciones_gasto` en contable.
- **ITBMS/ISR:** es `f.clasificaciones_gasto?.nombre`.
`gastoDe(f)` (función global) devuelve esa etiqueta y se usa en TODO por igual: columna GASTO del detallado, agrupación del reporte por gasto, filtros, drill-down y exportes Excel. Sin cuenta/clasificación → `'Sin clasificar'` (se muestra `—` en columnas). El catálogo del desplegable lo arma `nombresGastoDisponibles()`: en contable las cuentas de gasto/costo (`tipo in ('gasto','costo') && es_movimiento && activo`), en ITBMS/ISR las `clasificaciones` del módulo; ambos + los ya usados en facturas, y se **auto-actualiza** al crear cuenta/clasificación.

**Reportes (sesión 6):** el antiguo "Resumen por concepto" ahora es **"Reporte por gasto"** (con filtro por gasto). El "Reporte detallado" cambió su filtro/columna "concepto" por **"gasto"**. Todos los reportes anuales y de análisis están **escalados por `anioActivo`** (ver Integridad #9).

**Ingresos mensuales:** el modal de alta tiene **selector de AÑO** (`fi-anio`, sesión 6) — antes guardaba con el año del sistema fijo. `abrirModalIngreso(mes,anio)` precarga valores existentes (sirve para editar un mes). La tabla de ingresos muestra columna AÑO.

**Clientes reales en producción (sesión 4):**
| Nombre | ID | Uso |
|---|---|---|
| **Dra. Lemm** | `ab2450ae-cccf-4323-9f6d-6a68b3171d60` | Clínica — **módulo CONTABLE** (27 facturas compra, 27 asientos, 40 cuentas). Cliente principal. NO romper. |
| Arenas & Barletta Corp S.A | `33333333-3333-3333-3333-333333333333` | RRHH (hardcoded en detectModulo) |
| Administradora (personal) | `22222222-2222-2222-2222-222222222222` | ISR (hardcoded en detectModulo) |
| Licda. Kiria Plaza | `dbdd0bef-7230-417d-82f3-78f2acca45db` | — |
| Cliente prueba - Contabilidad | `1dadbd23-42c2-4ceb-ba8d-2ace534d15f6` | **PRUEBA** — candidata a archivar |
| Dra. M.C. Lemm - Pruba 2025 no usar | `11111111-1111-1111-1111-111111111111` | **PRUEBA** — no usar |

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
- **Drill-down a facturas (sesión 6):** cualquier monto por mes/año/gasto abre la factura para editarla sin salir de la vista. Modal `modal-drill` + `drillFacturas(lista,titulo,sub)`; helpers `facturasDe(mes,anio)`, `drillMes(mes)`, `drillGasto(nombre,desde,hasta)` (case-insensitive), `drillEditar(id)`→`abrirEdicionFactura`. Cableado en: reporte anual ITBMS (celdas de compras→drillMes, celdas de ingresos→`abrirModalIngreso`), reporte anual de compras, Análisis ITBMS (lista "facturas del mes" + monto ITBMS compras), dashboard "Estado por mes", reporte por gasto (fila→drillGasto). Detallado y lista de facturas ya tenían doble-clic. Tras guardar una edición, se re-renderiza **la página activa** (`paginaActivaId()`), no siempre "facturas", para que la vista donde estabas se actualice sola.

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
9. **Reportes escalados por año (sesión 6):** `anioActivo` arranca en el **año actual** (`new Date().getFullYear()`, antes fijo 2025). `itbmsRes(mes,anio)` filtra por año (antes sumaba todos los años → la fila TOTAL mostraba montos con las filas de detalle en cero). Reporte anual ITBMS, anual de compras, Análisis ITBMS y "Estado por mes" del dashboard filtran por `anioActivo`. Comparación de año robusta (`Number(i.anio)===Number(anioActivo)`) por si viene como texto.

---

## 👤 Super Admin — Herramientas

- **Crear cliente en 1 paso:** `api/create-client.js` (usa `SUPABASE_SERVICE_ROLE_KEY` **legacy** como env var en Vercel; verifica que el llamante sea super_admin con la publishable key en `/auth/v1/user`). Frontend `guardarNuevoCliente()` con checkbox "AENA Contable" (siembra plan) y contraseña temporal opcional. **OJO:** exige `adminEmail` y crea un login admin atado a esa empresa → para empresas que se onboardean por invitación, NO usar el correo real del invitado al crear la empresa (colisiona con la invitación; usar placeholder).
- **Invitar usuario multiempresa (sesión 4):** botón **✉ Invitar usuario** en 👑 Gestión de clientes. `abrirInvitar()` lista las empresas como checkboxes; `generarInvitacion()` inserta en `invitaciones_usuario` y arma el enlace `/invitacion.html?token=…` (un solo uso, con vencimiento, correo opcional para reservarlo). El invitado abre el enlace, pone correo+contraseña → `api/aceptar-invitacion.js` (service role) crea login confirmado + perfil `usuarios` (rol del token, sin `cliente_id`) + filas en `usuario_clientes`, y marca el token usado. `copiarInvLink()` copia el enlace.
- **Gestión de clientes** (Configuración): "Ver detalles" (`verDetalleCliente` → usuarios/correos/rol), "Administrar" (`administrarCliente`), "Editar" (`abrirEditarCliente`/`guardarEdicionCliente`).
- **⚠️ CRÍTICO — Editar cliente y módulos:** `guardarEdicionCliente` recorre `MODULOS_DISPONIBLES` (itbms, isr, rrhh, **contable**) y escribe `cliente_modulos` según las casillas del modal `modal-editar-cliente`. **Toda casilla de módulo debe existir en ese modal** (`ec2-mod-<key>`). En sesión 4 hubo un bug: faltaba la casilla `ec2-mod-contable`, así que al editar/renombrar a Dra. Lemm se leía como `false` y **desactivaba el módulo Contable** (los datos seguían intactos, pero la app dejaba de cargar la contabilidad). **Arreglado:** se agregó la casilla Contable + la función ahora **omite** (no toca) cualquier módulo cuya casilla no exista. Si en el futuro se agrega un módulo nuevo a `MODULOS_DISPONIBLES`, **hay que agregar también su casilla al modal**.
- **Recuperar acceso:** el correo del super_admin se ve en Supabase → Authentication → Users (o tabla `usuarios`, `rol=super_admin`). La contraseña **no se puede recuperar** (encriptada); se restablece desde "¿Olvidaste tu contraseña?" en el login o desde Supabase Auth.

---

## 🔜 Trabajo Pendiente

- **Facturas de Dra. Lemm sin cuenta contable:** muchas facturas de compra no tienen `cuenta_id` asignado → salen como `—`/"Sin clasificar" en la columna GASTO y no suman en el reporte por gasto. Se pueden clasificar abriendo cada factura (clic en la fila → elegir cuenta → guardar). Amilkar evaluó opciones ofrecidas (columna "gasto" en el importador CSV; o clasificador rápido por fila en el detallado) — **pendiente de decidir cuál construir**.
- **Dar acceso a Kiria en la reunión de hoy** (ver Nota de Hoy): invitación por `usuario_clientes`.
- **Mejoras al módulo RRHH** para registro diario (interés declarado de Amilkar; aún sin empezar).
- **Editar facturas de ingreso:** hoy solo hay alta. Falta flujo de edición y que **regenere su asiento** al editar (como ya hace la factura de compra).
- **Seguridad `clientes_public_read`:** cerrar la política que deja listar nombres de todas las empresas a cualquier sesión. Cambiar a que cada quien vea solo los nombres de sus empresas (super_admin todos).
- **Archivar/ocultar clientes de prueba** del selector ("Cliente prueba - Contabilidad", "Dra. M.C. Lemm - Pruba 2025 no usar"). Idea: columna `activo`/`archivado` en `clientes` + filtrar en `loadUser`/`renderSAClientes`. (Pendiente de implementar; el usuario lo pidió.)
- Limpieza de SQL: unificar funciones RLS (`es_super_admin` vs `is_super_admin`, `get_cliente_id` vs `get_my_cliente_id`).
- Probar a fondo el estado de ventanas por cliente (que asiento/factura de ingreso restaure bien al volver).

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

### Sesión 4 — 2026-06-27
**Multiempresa por usuario + onboarding por invitación (en `main`):**
- **Modelo de acceso:** un usuario puede tener acceso a **varias empresas**. Tabla nueva **`usuario_clientes(usuario_id, cliente_id)`** = membresía. Función **`tiene_acceso_cliente(cliente_id)`** = `es_super_admin()` OR `cliente_id = get_cliente_id()` (caso viejo, retrocompatible) OR existe fila en `usuario_clientes`.
- **RLS:** TODAS las políticas de tablas financieras/fiscales reescritas a `tiene_acceso_cliente(cliente_id)` (facturas, ingresos, proveedores, clasificaciones_gasto, cuentas_contables, asientos, asiento_lineas, facturas_ingreso, SELECT de cliente_modulos). **RRHH NO se tocó** (sigue con `get_cliente_id`/`get_my_cliente_id`). De paso se limpiaron políticas duplicadas de `proveedores`.
- **Código (`index.html`):** `loadUser` lee `usuario_clientes` con fallback al `cliente_id` único; `detectModulo` recalcula módulos por empresa para usuarios con >1 empresa; selector de empresa visible para cualquier usuario con >1 empresa (label dinámico EMPRESA / CLIENTE).
- **Onboarding por enlace (un solo uso):**
  - Tabla **`invitaciones_usuario`** (token, cliente_ids uuid[], email opcional, rol, expira, usado…). RLS: solo super_admin la gestiona.
  - UI super admin: botón **✉ Invitar usuario** (modal `modal-invitar`) → `abrirInvitar`/`generarInvitacion`/`copiarInvLink`. Marca empresas → genera `/invitacion.html?token=…`.
  - **`invitacion.html`**: página del invitado (correo + contraseña).
  - **`api/aceptar-invitacion.js`** (Service Role): GET previsualiza; POST crea login confirmado + perfil `usuarios` + membresías `usuario_clientes`, marca token usado. Rollback si algo falla.
- **Caso de uso:** administradora de clínica con un solo login que alterna Clínica (ITBMS) ↔ Personal (ISR); su contador igual (acceso ver+registrar).
- **Nota de seguridad pendiente:** `clientes` tiene política `clientes_public_read` (qual `true`) que deja listar **nombres** de todas las empresas a cualquier sesión (los datos sí están protegidos). Venía de antes; cerrar en sesión aparte.
- **Crear cliente con el botón:** `api/create-client.js` exige `adminEmail` y crea un login admin atado a esa empresa. Para empresas que se onboardean por invitación, NO usar el correo real del invitado al crear la empresa (colisiona con la invitación).

### Sesión 5 — 2026-06-27 (continuación)
**Bug del módulo Contable al editar cliente + endurecimiento:**
- **Causa:** el modal `modal-editar-cliente` no tenía la casilla `ec2-mod-contable`. `guardarEdicionCliente` leía esa casilla inexistente como `false` y, al guardar (p. ej. al renombrar), **desactivaba el módulo Contable** del cliente. Le pasó a **Dra. Lemm**: la contabilidad "desapareció" de la app aunque los 27 registros seguían intactos en la base.
- **Fix (en `main`):** (1) se agregó la casilla "AENA Contable" al modal; (2) `guardarEdicionCliente` ahora **solo modifica módulos cuya casilla existe** (`if(!cb) continue;`), nunca apaga por omisión.
- **Recuperación de datos:** SQL para reactivar el módulo (`UPDATE cliente_modulos SET activo=true WHERE cliente_id='ab2450ae…' AND modulo='contable'`, con INSERT de respaldo si no existía la fila). Verificado: 27 facturas, 27 asientos, 69 líneas, 40 cuentas intactos.
- **Lección:** al agregar un módulo a `MODULOS_DISPONIBLES`, **agregar también su casilla `ec2-mod-<key>`** al modal de editar cliente y a "nuevo cliente" (`nc-mod-<key>`).
- **MASTER:** actualizado de forma integral (estructura, tablas multiempresa, RLS nueva, clientes reales con IDs, herramientas super admin, invitaciones).

### Sesión 6 — 2026-07-03
**Reportes por año + drill-down + gasto desde la cuenta contable (todo en `main`, en vivo). Solo `index.html`.**
- **Bug reporte anual ITBMS:** las filas de detalle salían en $0.00 pero la fila TOTAL sí mostraba montos. Causa: `itbmsRes()` no filtraba por año (sumaba todos) mientras las filas de detalle sí. Además los datos de la Dra. Lemm estaban bajo **2026** y el reporte abría fijo en **2025**. Fix: `itbmsRes(mes,anio)` filtra por año; `anioActivo` arranca en el año actual; comparación de año robusta (`Number()`); Análisis ITBMS y dashboard escalados al año activo. También se corrigió el manifest (`start_url` absoluto) y el favicon 404 (SVG inline).
- **Selector de año en ingresos:** el modal de alta de ingresos no tenía año (guardaba con el año del sistema fijo). Se agregó `fi-anio`; `abrirModalIngreso(mes,anio)` precarga valores para editar; la tabla muestra columna AÑO.
- **Renombre de reportes:** "Resumen por concepto" → **"Reporte por gasto"** (con filtro por gasto); "Reporte detallado" cambió filtro/columna "concepto" → **"gasto"**. Excel de ambos actualizado.
- **Drill-down:** cualquier monto por mes/año/gasto abre la factura para editarla sin salir de la vista (`modal-drill` + `drillFacturas`/`drillMes`/`drillGasto`/`facturasDe`). Al guardar edición se refresca la página activa (`paginaActivaId()`). Ver sección Ventanas.
- **GASTO = cuenta contable (en módulo contable):** el filtro de gasto solo mostraba "Sin clasificar" y la columna GASTO salía "—" porque en contable la factura se clasifica por **`cuenta_id`** (cuenta contable), no por `clasificaciones_gasto`. Se creó `gastoDe(f)` (cuenta en contable, clasificación en ITBMS/ISR) y `nombresGastoDisponibles()` (catálogo del módulo, auto-actualizable), aplicados en columnas, agrupaciones, filtros, drill y Excel. `drillGasto` se hizo case-insensitive (el por-gasto agrupa en MAYÚSCULAS).
- **Dato:** las facturas de compra de la Dra. Lemm que no tienen `cuenta_id` siguen mostrándose sin gasto; hay que asignarles cuenta (ver Trabajo Pendiente).

### Sesión 7 — 2026-07-04
**Clon Dra. Lemm → Kiria, búsqueda de cuentas por nombre, e ITBMS→gasto para Kiria. Prep para reunión 8:30am.**
- **Clon Dra. Lemm → Licda. Kiria Plaza (solo datos, vía SQL):** se clonó el **plan de cuentas** (solo las que le faltaban a Kiria; ella ya tenía 35, terminó en 47) y la **lista de proveedores** (0 → 49). Guardas: `not exists` anti-duplicados (cuentas por `numero_cuenta`, proveedores por nombre/RUC) y salvaguarda de una sola cuenta `es_itbms`. **No** se clonaron asientos/facturas/ingresos (datos operativos propios de cada cliente). IDs: Lemm `ab2450ae-cccf-4323-9f6d-6a68b3171d60`, Kiria `dbdd0bef-7230-417d-82f3-78f2acca45db`.
- **Búsqueda de cuenta contable por nombre (código, `index.html`, en `main`):** los campos/filtros de cuenta ahora permiten escribir **nombre o número** (ej. "estaci") con `<input list>`+`<datalist>`. Aplicado en 4 puntos: (1) selector de cuenta en la línea de la factura de compra — resuelve a una cuenta vía `cuentaIdDesdeTexto()`, conserva la opción "➕ Agregar cuenta nueva…"; (2) filtro GASTO del **Reporte por gasto**; (3) filtro GASTO del **Reporte detallado** (y su Excel); (4) selector de cuenta del **Mayor General**. Filtros de reporte usan match "contiene" (case-insensitive). Helpers nuevos: `cuentaDisplay()`, `cuentaIdDesdeTexto()`, `onCuentaLineaInput()`. Aplica a **todas** las empresas con módulo contable. **NO** se tocaron (por ahora, más cortos/delicados): campo de cuenta en factura de ingreso (`mfi-cuenta`), contrapartida (`fc-contrapartida`), editor manual de asientos.
- **ITBMS→gasto solo para Kiria (SQL, sin código):** Kiria no es contribuyente de ITBMS (0 ITBMS en ventas). Se creó cuenta `5150 · Gasto ITBMS` (tipo gasto, deudora, movimiento), se **marcó como su cuenta `es_itbms`** y se desmarcó la 2102, y se movieron las **25 líneas de ITBMS de compra ($183.03)** de 2102 → 5150. Efecto: histórico reubicado (asientos siguen cuadrados, débito→débito) y facturas futuras de Kiria mandan el ITBMS al gasto automáticamente, sin cambio de código. La 2102 de Kiria quedó sin uso (saldo 0, sin marcar).
  - **Regla nueva:** `es_itbms` es **por-cliente**. Para un cliente **no contribuyente**, se puede apuntar `es_itbms` a una cuenta de **gasto** para que el ITBMS de compras sea costo (válido solo si NO cobra ITBMS en ventas; si algún día cobra, replantear).
