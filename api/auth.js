const { getSql, ensureCompany, send } = require('./_db');
const { issueSession, getSessionUser, clearSession } = require('./_session');

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    const company = await ensureCompany(sql);

    if (req.method === 'GET') {
      const rows = await sql`SELECT name FROM users WHERE company_id = ${company.id} ORDER BY created_at LIMIT 1`;
      const sessionUser = await getSessionUser(sql, req);
      return send(res, 200, {
        ok: true,
        online: true,
        hasUser: rows.length > 0,
        hasSession: !!sessionUser,
        sessionUser: sessionUser ? {
          id: sessionUser.id,
          name: sessionUser.name,
          login: sessionUser.local_id,
          role: sessionUser.role
        } : null,
        companyName: company.name || ''
      });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

    const action = String(req.body?.action || '');

    if (action === 'logout') {
      await clearSession(sql, req, res);
      return send(res, 200, { ok: true, loggedOut: true });
    }

    const pinHash = String(req.body?.pinHash || '');
    const name = String(req.body?.name || 'Administrador').trim() || 'Administrador';
    const login = String(req.body?.login || 'admin').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/i.test(pinHash)) return send(res, 400, { ok: false, error: 'INVALID_PIN_HASH' });
    if (!/^[a-z0-9._-]{3,30}$/.test(login)) return send(res, 400, { ok: false, error: 'INVALID_LOGIN' });

    if (action === 'register') {
      const existing = await sql`SELECT id, name, local_id, role, pin_hash FROM users WHERE company_id = ${company.id} ORDER BY created_at`;
      if (!existing.length) {
        const rows = await sql`
          INSERT INTO users (company_id, local_id, name, role, pin_hash)
          VALUES (${company.id}, ${login}, ${name}, 'admin', ${pinHash})
          RETURNING id, name, local_id, role
        `;
        const user = rows[0];
        await issueSession(sql, res, company.id, user.id);
        return send(res, 200, { ok: true, user: { id:user.id, name:user.name, login:user.local_id, role:user.role }, created: true });
      }
      const same = existing.find(u => String(u.local_id || '').toLowerCase() === login && u.pin_hash === pinHash);
      if (same) {
        await issueSession(sql, res, company.id, same.id);
        return send(res, 200, { ok: true, user: { id:same.id, name:same.name, login:same.local_id, role:same.role }, created: false });
      }
      return send(res, 409, { ok: false, error: 'USER_ALREADY_EXISTS' });
    }

    if (action === 'login') {
      const rows = await sql`
        SELECT id, name, local_id, role FROM users
        WHERE company_id = ${company.id} AND lower(coalesce(local_id,'')) = ${login} AND pin_hash = ${pinHash}
        LIMIT 1
      `;
      if (!rows.length) return send(res, 401, { ok: false, error: 'INVALID_CREDENTIALS' });
      const user = rows[0];
      await issueSession(sql, res, company.id, user.id);
      return send(res, 200, { ok: true, user: { id:user.id, name:user.name, login:user.local_id, role:user.role } });
    }

    return send(res, 400, { ok: false, error: 'INVALID_ACTION' });
  } catch (err) {
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    console.error(err);
    return send(res, missing ? 503 : 500, { ok: false, error: missing ? 'DATABASE_NOT_CONNECTED' : 'SERVER_ERROR' });
  }
};
