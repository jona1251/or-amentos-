const { getSql, ensureCompany, send } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    const company = await ensureCompany(sql);

    if (req.method === 'GET') {
      const rows = await sql`SELECT name FROM users WHERE company_id = ${company.id} ORDER BY created_at LIMIT 1`;
      return send(res, 200, {
        ok: true,
        online: true,
        hasUser: rows.length > 0,
        userName: rows[0]?.name || '',
        companyName: company.name || ''
      });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

    const action = req.body?.action;
    const pinHash = String(req.body?.pinHash || '');
    const name = String(req.body?.name || 'Administrador').trim() || 'Administrador';
    if (!/^[a-f0-9]{64}$/i.test(pinHash)) return send(res, 400, { ok: false, error: 'INVALID_PIN_HASH' });

    if (action === 'register') {
      const existing = await sql`SELECT id, name, pin_hash FROM users WHERE company_id = ${company.id} ORDER BY created_at LIMIT 1`;
      if (!existing.length) {
        const rows = await sql`
          INSERT INTO users (company_id, local_id, name, role, pin_hash)
          VALUES (${company.id}, 'admin', ${name}, 'admin', ${pinHash})
          RETURNING id, name
        `;
        return send(res, 200, { ok: true, user: rows[0], created: true });
      }
      if (existing[0].pin_hash === pinHash) return send(res, 200, { ok: true, user: { id: existing[0].id, name: existing[0].name }, created: false });
      return send(res, 409, { ok: false, error: 'USER_ALREADY_EXISTS' });
    }

    if (action === 'login') {
      const rows = await sql`
        SELECT id, name FROM users
        WHERE company_id = ${company.id} AND pin_hash = ${pinHash}
        LIMIT 1
      `;
      if (!rows.length) return send(res, 401, { ok: false, error: 'INVALID_PIN' });
      return send(res, 200, { ok: true, user: rows[0] });
    }

    return send(res, 400, { ok: false, error: 'INVALID_ACTION' });
  } catch (err) {
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    return send(res, missing ? 503 : 500, { ok: false, error: missing ? 'DATABASE_NOT_CONNECTED' : 'SERVER_ERROR' });
  }
};
