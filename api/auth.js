const { getDb, ensureCompany, send, writeAudit } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const company = await ensureCompany(db);
    const users = db.collection('users');

    if (req.method === 'GET') {
      const user = await users.findOne({ companyId: company._id }, { sort: { createdAt: 1 } });
      return send(res, 200, {
        ok: true,
        online: true,
        provider: 'mongodb',
        hasUser: !!user,
        userName: user?.name || '',
        companyName: company.name || company.settings?.companyName || '',
      });
    }

    if (req.method !== 'POST') {
      return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const action = req.body?.action;
    const pinHash = String(req.body?.pinHash || '');
    const name = String(req.body?.name || 'Administrador').trim() || 'Administrador';

    if (!/^[a-f0-9]{64}$/i.test(pinHash)) {
      return send(res, 400, { ok: false, error: 'INVALID_PIN_HASH' });
    }

    if (action === 'register') {
      const existing = await users.findOne({ companyId: company._id }, { sort: { createdAt: 1 } });
      if (!existing) {
        const doc = {
          companyId: company._id,
          localId: 'admin',
          name,
          role: 'admin',
          pinHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await users.insertOne(doc);
        await writeAudit(db, company._id, 'create', 'user', 'admin');
        return send(res, 200, {
          ok: true,
          user: { id: String(result.insertedId), name },
          created: true,
        });
      }

      if (existing.pinHash === pinHash) {
        return send(res, 200, {
          ok: true,
          user: { id: String(existing._id), name: existing.name },
          created: false,
        });
      }

      return send(res, 409, { ok: false, error: 'USER_ALREADY_EXISTS' });
    }

    if (action === 'login') {
      const user = await users.findOne({ companyId: company._id, pinHash });
      if (!user) return send(res, 401, { ok: false, error: 'INVALID_PIN' });
      await writeAudit(db, company._id, 'login', 'user', user.localId || 'admin');
      return send(res, 200, {
        ok: true,
        user: { id: String(user._id), name: user.name },
      });
    }

    return send(res, 400, { ok: false, error: 'INVALID_ACTION' });
  } catch (err) {
    const missing = err?.message === 'MONGODB_URI_NOT_CONFIGURED';
    console.error('auth', err);
    return send(res, missing ? 503 : 500, {
      ok: false,
      error: missing ? 'DATABASE_NOT_CONNECTED' : 'SERVER_ERROR',
    });
  }
};
