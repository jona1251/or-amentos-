const { MongoClient } = require('mongodb');

const globalCache = globalThis.__orcaMongo || (globalThis.__orcaMongo = {
  client: null,
  db: null,
  uri: null,
  dbName: null,
  indexesReady: false,
});

function resolveMongoConfig() {
  const candidates = [
    ['MONGODB_URI', process.env.MONGODB_URI],
    ['MONGODB_URL', process.env.MONGODB_URL],
    ['MONGO_URL', process.env.MONGO_URL],
  ];

  for (const [source, value] of candidates) {
    if (typeof value === 'string' && /^mongodb(\+srv)?:\/\//i.test(value)) {
      let dbName = process.env.MONGODB_DB || process.env.MONGO_DB || '';
      if (!dbName) {
        try {
          const u = new URL(value);
          dbName = decodeURIComponent((u.pathname || '').replace(/^\//, ''));
        } catch (_) {}
      }
      return { uri: value, source, dbName: dbName || 'orcafacil' };
    }
  }

  return { uri: null, source: null, dbName: process.env.MONGODB_DB || 'orcafacil' };
}

async function ensureIndexes(db) {
  if (globalCache.indexesReady) return;
  await Promise.all([
    db.collection('companies').createIndex({ localId: 1 }, { unique: true }),
    db.collection('users').createIndex({ companyId: 1, localId: 1 }, { unique: true }),
    db.collection('users').createIndex({ companyId: 1, pinHash: 1 }),
    db.collection('clients').createIndex({ companyId: 1, localId: 1 }, { unique: true }),
    db.collection('products').createIndex({ companyId: 1, localId: 1 }, { unique: true }),
    db.collection('budgets').createIndex({ companyId: 1, localId: 1 }, { unique: true }),
    db.collection('budgets').createIndex({ companyId: 1, updatedAt: -1 }),
    db.collection('contracts').createIndex({ companyId: 1, localId: 1 }, { unique: true }),
    db.collection('contracts').createIndex({ companyId: 1, updatedAt: -1 }),
    db.collection('audit_logs').createIndex({ companyId: 1, createdAt: -1 }),
  ]);
  globalCache.indexesReady = true;
}

async function getDb() {
  const cfg = resolveMongoConfig();
  if (!cfg.uri) throw new Error('MONGODB_URI_NOT_CONFIGURED');

  if (!globalCache.client || globalCache.uri !== cfg.uri) {
    if (globalCache.client) {
      try { await globalCache.client.close(); } catch (_) {}
    }
    const client = new MongoClient(cfg.uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 8000,
    });
    await client.connect();
    globalCache.client = client;
    globalCache.uri = cfg.uri;
    globalCache.dbName = cfg.dbName;
    globalCache.db = client.db(cfg.dbName);
    globalCache.indexesReady = false;
  } else if (!globalCache.db || globalCache.dbName !== cfg.dbName) {
    globalCache.dbName = cfg.dbName;
    globalCache.db = globalCache.client.db(cfg.dbName);
    globalCache.indexesReady = false;
  }

  await ensureIndexes(globalCache.db);
  return globalCache.db;
}

async function ensureCompany(db) {
  const companies = db.collection('companies');
  await companies.updateOne(
    { localId: 'main' },
    {
      $setOnInsert: {
        localId: 'main',
        name: 'Minha empresa',
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
  return companies.findOne({ localId: 'main' });
}

async function authenticate(db, req, companyId) {
  const token = String(req.headers['x-orca-auth'] || '');
  if (!token) return null;
  return db.collection('users').findOne({ companyId, pinHash: token });
}

async function writeAudit(db, companyId, action, entityType, localId, details = null) {
  try {
    await db.collection('audit_logs').insertOne({
      companyId,
      action,
      entityType,
      localId: localId || null,
      details,
      createdAt: new Date(),
    });
  } catch (_) {}
}

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = {
  getDb,
  ensureCompany,
  authenticate,
  writeAudit,
  send,
  resolveMongoConfig,
};
