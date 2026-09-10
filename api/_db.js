const { neon } = require('@neondatabase/serverless');

function getSql() {
  const url = process.env.DATABASE_URL;
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

module.exports = { getSql, ensureCompany, authenticate, send };
