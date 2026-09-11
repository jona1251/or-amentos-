const { getDb, resolveMongoConfig, send } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const cfg = resolveMongoConfig();
  if (!cfg.uri) {
    return send(res, 503, {
      ok: false,
      configured: false,
      provider: 'mongodb',
      source: null,
      database: cfg.dbName,
      error: 'DATABASE_NOT_CONFIGURED',
    });
  }

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return send(res, 200, {
      ok: true,
      configured: true,
      provider: 'mongodb',
      source: cfg.source,
      database: db.databaseName,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('health', err);
    return send(res, 500, {
      ok: false,
      configured: true,
      provider: 'mongodb',
      source: cfg.source,
      database: cfg.dbName,
      error: 'DATABASE_CONNECTION_FAILED',
    });
  }
};
