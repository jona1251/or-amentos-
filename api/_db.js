const { neon } = require('@neondatabase/serverless');

function resolveDatabaseUrl() {
  const candidates = [
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['POSTGRES_URL', process.env.POSTGRES_URL],
    ['NEON_DATABASE_URL', process.env.NEON_DATABASE_URL],
    ['NEON_POSTGRES_URL', process.env.NEON_POSTGRES_URL],
    ['POSTGRES_PRISMA_URL', process.env.POSTGRES_PRISMA_URL]
  ];
  for (const [name, value] of candidates) {
    if (typeof value === 'string' && /^postgres(ql)?:\/\//i.test(value)) return { url:value, source:name };
  }
  const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;
  if (PGHOST && PGDATABASE && PGUSER && PGPASSWORD) {
    const user = encodeURIComponent(PGUSER);
    const pass = encodeURIComponent(PGPASSWORD);
    const db = encodeURIComponent(PGDATABASE);
    const port = PGPORT || '5432';
    return { url:`postgresql://${user}:${pass}@${PGHOST}:${port}/${db}?sslmode=require`, source:'PG*' };
  }
  return { url:null, source:null };
}

function getSql() {
  const { url } = resolveDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return neon(url);
}

async function ensureCompany(sql) {
  let rows = await sql`SELECT * FROM companies WHERE local_id = 'main' LIMIT 1`;
  if (!rows.length) {
    rows = await sql`
      INSERT INTO companies (local_id, name)
      VALUES ('main', 'Minha empresa')
      RETURNING *
    `;
  }
  return rows[0];
}

async function authenticate(sql, req) {
  const token = String(req.headers['x-orca-auth'] || '');
  if (!token) return null;
  const rows = await sql`
    SELECT u.*, c.id AS resolved_company_id
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.pin_hash = ${token}
    LIMIT 1
  `;
  return rows[0] || null;
}

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = { getSql, ensureCompany, authenticate, send, resolveDatabaseUrl };
