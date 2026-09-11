const { neon } = require('@neondatabase/serverless');

let schemaPromise = null;

function resolveDatabaseUrl() {
  const candidates = [
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['POSTGRES_URL', process.env.POSTGRES_URL],
    ['NEON_DATABASE_URL', process.env.NEON_DATABASE_URL],
    ['NEON_POSTGRES_URL', process.env.NEON_POSTGRES_URL],
    ['POSTGRES_PRISMA_URL', process.env.POSTGRES_PRISMA_URL]
  ];
  for (const [name, value] of candidates) {
    if (typeof value === 'string' && /^postgres(ql)?:\/\//i.test(value)) return { url: value, source: name };
  }
  const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;
  if (PGHOST && PGDATABASE && PGUSER && PGPASSWORD) {
    return {
      url: `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT || '5432'}/${encodeURIComponent(PGDATABASE)}?sslmode=require`,
      source: 'PG*'
    };
  }
  return { url: null, source: null };
}

function getSql() {
  const { url } = resolveDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return neon(url);
}

async function ensureSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        local_id text UNIQUE,
        name text NOT NULL DEFAULT 'Minha empresa',
        document text,
        owner_name text,
        phone text,
        email text,
        address text,
        city text,
        pix_key text,
        logo_url text,
        slogan text,
        budget_prefix text NOT NULL DEFAULT 'ORC',
        budget_seq integer NOT NULL DEFAULT 1,
        contract_prefix text NOT NULL DEFAULT 'CTR',
        contract_seq integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
        local_id text,
        name text NOT NULL,
        email text,
        pin_hash text,
        role text NOT NULL DEFAULT 'admin',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id, local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS user_settings (
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name text NOT NULL DEFAULT 'Minha empresa',
        company_document text,
        company_owner text,
        company_phone text,
        company_email text,
        company_address text,
        company_city text,
        pix_key text,
        logo_url text,
        slogan text,
        budget_prefix text NOT NULL DEFAULT 'ORC',
        budget_seq integer NOT NULL DEFAULT 1,
        contract_prefix text NOT NULL DEFAULT 'CTR',
        contract_seq integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(company_id, user_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        local_id text NOT NULL,
        name text NOT NULL,
        document text,
        phone text,
        email text,
        address text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id, local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        local_id text NOT NULL,
        type text NOT NULL DEFAULT 'Produto',
        name text NOT NULL,
        code text,
        category text,
        unit text NOT NULL DEFAULT 'un',
        sale_price numeric(12,2) NOT NULL DEFAULT 0,
        cost_price numeric(12,2),
        stock numeric(12,3),
        description text,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id, local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS budgets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        local_id text NOT NULL,
        client_id uuid NOT NULL REFERENCES clients(id),
        number text NOT NULL,
        status text NOT NULL DEFAULT 'Rascunho',
        valid_days integer NOT NULL DEFAULT 10,
        payment_method text,
        deadline text,
        warranty text,
        execution_location text,
        notes text,
        subtotal numeric(12,2) NOT NULL DEFAULT 0,
        discount numeric(12,2) NOT NULL DEFAULT 0,
        total numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id, local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS budget_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        local_id text,
        product_id uuid REFERENCES products(id) ON DELETE SET NULL,
        description text NOT NULL,
        quantity numeric(12,3) NOT NULL DEFAULT 1,
        unit_price numeric(12,2) NOT NULL DEFAULT 0,
        total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
      )`;
      await sql`CREATE TABLE IF NOT EXISTS contracts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        local_id text NOT NULL,
        budget_id uuid NOT NULL REFERENCES budgets(id),
        client_id uuid NOT NULL REFERENCES clients(id),
        number text NOT NULL,
        contract_type text NOT NULL DEFAULT 'Prestação de Serviços',
        forum_city text,
        contract_term text,
        additional_clauses text,
        status text NOT NULL DEFAULT 'Rascunho',
        signed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id, local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS audit_log (
        id bigserial PRIMARY KEY,
        company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        entity_type text NOT NULL,
        entity_id uuid,
        action text NOT NULL,
        details jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;

      await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;

      await sql`ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_company_id_number_key`;
      await sql`ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_company_id_number_key`;

      await sql`CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_budgets_company_created ON budgets(company_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_contracts_company_created ON contracts(company_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_company_login ON users(company_id, local_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(company_id, owner_user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_owner ON products(company_id, owner_user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_budgets_owner ON budgets(company_id, owner_user_id, updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(company_id, owner_user_id, updated_at DESC)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_user_number ON budgets(company_id, owner_user_id, number) WHERE owner_user_id IS NOT NULL`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_user_number ON contracts(company_id, owner_user_id, number) WHERE owner_user_id IS NOT NULL`;
    })();
  }
  try {
    await schemaPromise;
  } catch (err) {
    schemaPromise = null;
    throw err;
  }
}

async function ensureCompany(sql) {
  await ensureSchema(sql);
  let rows = await sql`SELECT * FROM companies WHERE local_id = 'main' LIMIT 1`;
  if (!rows.length) rows = await sql`INSERT INTO companies (local_id, name) VALUES ('main', 'Minha empresa') RETURNING *`;
  return rows[0];
}

async function ensureLegacyOwnership(sql, companyId) {
  const first = await sql`SELECT id FROM users WHERE company_id=${companyId} ORDER BY created_at ASC LIMIT 1`;
  const ownerId = first[0]?.id;
  if (!ownerId) return null;
  await sql`UPDATE clients SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`UPDATE products SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`UPDATE budgets SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`UPDATE contracts SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`
    INSERT INTO user_settings (
      company_id,user_id,company_name,company_document,company_owner,company_phone,company_email,company_address,company_city,
      pix_key,logo_url,slogan,budget_prefix,budget_seq,contract_prefix,contract_seq
    )
    SELECT id,${ownerId},name,document,owner_name,phone,email,address,city,pix_key,logo_url,slogan,budget_prefix,budget_seq,contract_prefix,contract_seq
    FROM companies WHERE id=${companyId}
    ON CONFLICT (company_id,user_id) DO NOTHING
  `;
  return ownerId;
}

async function authenticate(sql, req) {
  const token = String(req.headers['x-orca-auth'] || '').trim();
  const login = String(req.headers['x-orca-user'] || '').trim().toLowerCase();
  if (!token) return null;
  let rows;
  if (login) {
    rows = await sql`
      SELECT u.*, c.id AS resolved_company_id
      FROM users u JOIN companies c ON c.id = u.company_id
      WHERE u.pin_hash = ${token} AND lower(coalesce(u.local_id,'')) = ${login}
      LIMIT 1
    `;
  } else {
    rows = await sql`
      SELECT u.*, c.id AS resolved_company_id
      FROM users u JOIN companies c ON c.id = u.company_id
      WHERE u.pin_hash = ${token}
      ORDER BY u.created_at
      LIMIT 1
    `;
  }
  return rows[0] || null;
}

function send(res, status, body) { res.status(status).json(body); }

module.exports = { getSql, ensureSchema, ensureCompany, ensureLegacyOwnership, authenticate, send, resolveDatabaseUrl };
