// Flujo de invitación por token para acceso multiempresa.
// GET  ?token=XXX           -> valida el token y devuelve las empresas (sin datos sensibles)
// POST { token, email, password, nombre } -> crea el login, el perfil y las membresías
// Requiere SUPABASE_SERVICE_ROLE_KEY en Vercel. El invitado nunca toca privilegios:
// todo se valida y escribe del lado servidor contra la tabla invitaciones_usuario.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dqobxvvpzzngljwdalnq.supabase.co';
const PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_rCbSAjOlexErR9WBN-rfZA_8Tadpfa0';

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  if (prefer) headers['Prefer'] = prefer;
  const r = await fetch(SUPABASE_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

// Carga la invitación y valida estado. Devuelve { inv, error }.
async function cargarInvitacion(token) {
  if (!token) return { error: 'Falta el token.' };
  const res = await sb('/rest/v1/invitaciones_usuario?token=eq.' + encodeURIComponent(token) + '&select=*');
  if (!res.ok || !Array.isArray(res.data) || !res.data[0]) return { error: 'Invitación no encontrada.' };
  const inv = res.data[0];
  if (inv.usado) return { error: 'Esta invitación ya fue utilizada.' };
  if (inv.expira && new Date(inv.expira) < new Date()) return { error: 'Esta invitación expiró. Pide un enlace nuevo.' };
  return { inv };
}

async function nombresEmpresas(clienteIds) {
  if (!Array.isArray(clienteIds) || !clienteIds.length) return [];
  const list = '(' + clienteIds.map(id => '"' + id + '"').join(',') + ')';
  const res = await sb('/rest/v1/clientes?id=in.' + encodeURIComponent(list) + '&select=id,nombre');
  return (res.ok && Array.isArray(res.data)) ? res.data.map(c => c.nombre) : [];
}

export default async function handler(req, res) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
    }

    // ---- GET: previsualizar la invitación ----
    if (req.method === 'GET') {
      const token = req.query?.token;
      const { inv, error } = await cargarInvitacion(token);
      if (error) return res.status(400).json({ error });
      const empresas = await nombresEmpresas(inv.cliente_ids);
      return res.status(200).json({
        ok: true,
        empresas,
        email_fijo: inv.email || null,   // si viene fijo, el invitado no puede cambiarlo
        rol: inv.rol || 'admin'
      });
    }

    // ---- POST: aceptar la invitación ----
    if (req.method === 'POST') {
      const { token, email, password, nombre } = req.body || {};
      const { inv, error } = await cargarInvitacion(token);
      if (error) return res.status(400).json({ error });

      const correo = (inv.email || email || '').trim().toLowerCase();
      if (!correo) return res.status(400).json({ error: 'Ingresa tu correo.' });
      if (inv.email && email && email.trim().toLowerCase() !== inv.email.trim().toLowerCase()) {
        return res.status(400).json({ error: 'Esta invitación está reservada para otro correo.' });
      }
      if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

      // 1) Crear el login (confirmado, entra de inmediato)
      const created = await sb('/auth/v1/admin/users', {
        method: 'POST',
        body: { email: correo, password, email_confirm: true, user_metadata: { nombre: nombre || correo } }
      });
      if (!created.ok || !created.data?.id) {
        const msg = created.data?.msg || created.data?.error_description || created.data?.error || '';
        if (/already|registered|exists/i.test(msg)) return res.status(400).json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión normalmente.' });
        return res.status(400).json({ error: 'No se pudo crear la cuenta: ' + (msg || 'error desconocido') });
      }
      const userId = created.data.id;

      // 2) Perfil en usuarios (rol del token; sin cliente_id: es multiempresa)
      const usr = await sb('/rest/v1/usuarios', {
        method: 'POST',
        body: { id: userId, nombre: nombre || correo, email: correo, rol: inv.rol || 'admin' }
      });
      if (!usr.ok) {
        await sb('/auth/v1/admin/users/' + userId, { method: 'DELETE' }); // rollback
        return res.status(400).json({ error: 'No se pudo crear el perfil: ' + (usr.data?.message || 'error') });
      }

      // 3) Membresías (una fila por empresa)
      const filas = (inv.cliente_ids || []).map(cid => ({ usuario_id: userId, cliente_id: cid }));
      if (filas.length) {
        const mem = await sb('/rest/v1/usuario_clientes', { method: 'POST', body: filas });
        if (!mem.ok) {
          await sb('/auth/v1/admin/users/' + userId, { method: 'DELETE' });
          await sb('/rest/v1/usuarios?id=eq.' + userId, { method: 'DELETE' });
          return res.status(400).json({ error: 'No se pudieron asignar las empresas: ' + (mem.data?.message || 'error') });
        }
      }

      // 4) Marcar el token usado
      await sb('/rest/v1/invitaciones_usuario?token=eq.' + encodeURIComponent(token), {
        method: 'PATCH', body: { usado: true, usado_por: userId, usado_at: new Date().toISOString() }
      });

      return res.status(200).json({ ok: true, email: correo });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
