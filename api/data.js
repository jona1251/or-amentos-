const { getDb, ensureCompany, authenticate, send, writeAudit } = require('./_db');

const ALLOWED_STORES = ['clients', 'products', 'budgets', 'contracts'];

function cleanRecord(record) {
  const out = { ...(record || {}) };
  delete out._id;
  delete out.companyId;
  delete out.localId;
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

async function saveSettings(db, company, record) {
  const settings = { ...(record || {}), id: 'main' };
  await db.collection('companies').updateOne(
    { _id: company._id },
    {
      $set: {
        name: settings.companyName || company.name || 'Minha empresa',
        settings,
        updatedAt: new Date(),
      },
    }
  );
}

async function saveRecord(db, companyId, store, record) {
  const localId = String(record?.id || '').trim();
  if (!localId) throw new Error('MISSING_LOCAL_ID');

  const doc = {
    ...cleanRecord(record),
    id: localId,
    localId,
    companyId,
    updatedAt: record.updatedAt || nowIso(),
  };

  if (!doc.createdAt) doc.createdAt = doc.updatedAt;

  await db.collection(store).updateOne(
    { companyId, localId },
    { $set: doc, $setOnInsert: { firstSyncedAt: new Date() } },
    { upsert: true }
  );
}

async function listRecords(db, companyId, store) {
  const rows = await db.collection(store)
    .find({ companyId })
    .sort({ updatedAt: 1 })
    .toArray();
  return rows.map(cleanRecord);
}

async function snapshot(db, company) {
  const freshCompany = await db.collection('companies').findOne({ _id: company._id });
  const defaultSettings = {
    id: 'main',
    companyName: freshCompany?.name || 'Minha empresa',
    companyDoc: '',
    companyOwner: '',
    companyPhone: '',
    companyEmail: '',
    companyAddress: '',
    companyCity: '',
    companyLogo: '',
    companySlogan: '',
    pixKey: '',
    budgetPrefix: 'ORC',
    budgetSeq: 1,
    contractPrefix: 'CTR',
    contractSeq: 1,
  };

  const [clients, products, budgets, contracts] = await Promise.all([
    listRecords(db, company._id, 'clients'),
    listRecords(db, company._id, 'products'),
    listRecords(db, company._id, 'budgets'),
    listRecords(db, company._id, 'contracts'),
  ]);

  return {
    settings: [{ ...defaultSettings, ...(freshCompany?.settings || {}), id: 'main' }],
    clients,
    products,
    budgets,
    contracts,
  };
}

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const company = await ensureCompany(db);
    const user = await authenticate(db, req, company._id);
    if (!user) return send(res, 401, { ok: false, error: 'UNAUTHORIZED' });

    if (req.method === 'GET') {
      return send(res, 200, { ok: true, provider: 'mongodb', data: await snapshot(db, company) });
    }

    if (req.method === 'POST') {
      const store = String(req.body?.store || '');
      const record = req.body?.record || {};

      if (store === 'settings') {
        await saveSettings(db, company, record);
        await writeAudit(db, company._id, 'upsert', 'settings', 'main');
      } else if (ALLOWED_STORES.includes(store)) {
        await saveRecord(db, company._id, store, record);
        await writeAudit(db, company._id, 'upsert', store, record.id || null);
      } else {
        return send(res, 400, { ok: false, error: 'INVALID_STORE' });
      }

      return send(res, 200, { ok: true, provider: 'mongodb' });
    }

    if (req.method === 'DELETE') {
      const store = String(req.query?.store || '');
      const id = String(req.query?.id || '');
      if (!ALLOWED_STORES.includes(store) || !id) {
        return send(res, 400, { ok: false, error: 'INVALID_DELETE' });
      }

      await db.collection(store).deleteOne({ companyId: company._id, localId: id });
      await writeAudit(db, company._id, 'delete', store, id);
      return send(res, 200, { ok: true, provider: 'mongodb' });
    }

    return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (err) {
    const missing = err?.message === 'MONGODB_URI_NOT_CONFIGURED';
    console.error('data', err);
    return send(res, missing ? 503 : 500, {
      ok: false,
      error: missing ? 'DATABASE_NOT_CONNECTED' : 'SERVER_ERROR',
    });
  }
};
