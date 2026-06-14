// Crea cliente + usuario admin (Supabase Auth) + módulos en un solo paso.
// Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Vercel.
// Seguridad: solo un usuario con rol 'super_admin' (verificado por su token) puede usarlo.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dqobxvvpzzngljwdalnq.supabase.co';

async function sb(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + (token || process.env.SUPABASE_SERVICE_ROLE_KEY)
  };
  if (prefer) headers['Prefer'] = prefer;
  const r = await fetch(SUPABASE_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel (Settings → Environment Variables).' });
    }

    // --- 1. Verificar que quien llama es super_admin ---
    const callerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!callerToken) return res.status(401).json({ error: 'No autenticado.' });
    const who = await sb('/auth/v1/user', { token: callerToken });
    if (!who.ok || !who.data?.id) return res.status(401).json({ error: 'Sesión inválida.' });
    const perfil = await sb('/rest/v1/usuarios?id=eq.' + who.data.id + '&select=rol', {});
    if (!perfil.ok || !Array.isArray(perfil.data) || perfil.data[0]?.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo un super admin puede crear clientes.' });
    }

    // --- 2. Datos ---
    const { nombre, ruc, dv, adminNombre, adminEmail, password, modulos } = req.body || {};
    if (!nombre || !adminEmail) return res.status(400).json({ error: 'Nombre de empresa y correo del administrador son obligatorios.' });
    const tempPass = (password && password.length >= 6) ? password : ('Aena-' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10));
    const mods = Array.isArray(modulos) ? modulos : [];

    // --- 3. Crear usuario en Auth (confirmado, puede entrar de inmediato) ---
    const created = await sb('/auth/v1/admin/users', {
      method: 'POST',
      body: { email: adminEmail, password: tempPass, email_confirm: true, user_metadata: { nombre: adminNombre || adminEmail } }
    });
    if (!created.ok || !created.data?.id) {
      return res.status(400).json({ error: 'No se pudo crear el usuario: ' + (created.data?.msg || created.data?.error_description || created.data?.error || 'error desconocido') });
    }
    const userId = created.data.id;

    // --- 4. Crear cliente ---
    const cliRes = await sb('/rest/v1/clientes', {
      method: 'POST', prefer: 'return=representation',
      body: { nombre, ruc: ruc || null, dv: dv || null }
    });
    if (!cliRes.ok || !cliRes.data?.[0]?.id) {
      await sb('/auth/v1/admin/users/' + userId, { method: 'DELETE' }); // rollback usuario
      return res.status(400).json({ error: 'No se pudo crear el cliente: ' + (cliRes.data?.message || 'error') });
    }
    const clienteId = cliRes.data[0].id;

    // --- 5. Perfil de usuario vinculado ---
    const usrRes = await sb('/rest/v1/usuarios', {
      method: 'POST',
      body: { id: userId, cliente_id: clienteId, nombre: adminNombre || adminEmail, email: adminEmail, rol: 'admin' }
    });
    if (!usrRes.ok) {
      return res.status(400).json({ error: 'Cliente creado, pero falló el perfil: ' + (usrRes.data?.message || 'error'), cliente_id: clienteId });
    }

    // --- 6. Módulos ---
    if (mods.length) {
      await sb('/rest/v1/cliente_modulos', { method: 'POST', body: mods.map(m => ({ cliente_id: clienteId, modulo: m, activo: true })) });
    }

    // --- 7. Si incluye contable, sembrar plan de cuentas ---
    if (mods.includes('contable')) {
      await sb('/rest/v1/rpc/seed_plan_cuentas', { method: 'POST', body: { p_cliente_id: clienteId } });
    }

    return res.status(200).json({ ok: true, cliente_id: clienteId, user_id: userId, email: adminEmail, password: tempPass, contable: mods.includes('contable') });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
