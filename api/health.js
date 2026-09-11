const { getSql, ensureSchema, resolveDatabaseUrl, send } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok:false, error:'METHOD_NOT_ALLOWED' });
  const cfg = resolveDatabaseUrl();
  if (!cfg.url) return send(res, 503, { ok:false, configured:false, provider:'postgres', source:null, error:'DATABASE_NOT_CONFIGURED' });
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`SELECT current_database() AS database_name, current_user AS role_name, now() AS server_time`;
    const tables = await sql`SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('companies','users','clients','products','budgets','budget_items','contracts','audit_log')`;
    return send(res, 200, {
      ok:true,
      configured:true,
      provider:'postgres',
      source:cfg.source,
      database:rows[0]?.database_name || null,
      role:rows[0]?.role_name || null,
      schemaReady:Number(tables[0]?.total || 0) === 8,
      tables:Number(tables[0]?.total || 0),
      serverTime:rows[0]?.server_time || null
    });
  } catch (err) {
    console.error('health', err);
    return send(res, 500, { ok:false, configured:true, provider:'postgres', source:cfg.source, error:'DATABASE_CONNECTION_FAILED' });
  }
};
