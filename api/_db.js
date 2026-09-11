const { neon, Pool, neonConfig } = require('@neondatabase/serverless');

try { neonConfig.webSocketConstructor = require('ws'); } catch (_) {}

const RLS_TABLES = ['user_settings','clients','products','budgets','budget_items','contracts'];
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
    if (typeof value === 'string' && /^postgres(ql)?:\/\//i.test(value)) return { url:value, source:name };
  }
  const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT } = process.env;
  if (PGHOST && PGDATABASE && PGUSER && PGPASSWORD) {
    return {
      url:`postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT || '5432'}/${encodeURIComponent(PGDATABASE)}?sslmode=require`,
      source:'PG*'
    };
  }
  return { url:null, source:null };
}

function getSql() {
  const { url } = resolveDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return neon(url);
}

async function policyExists(sql, tableName, policyName) {
  const rows = await sql`
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename=${tableName} AND policyname=${policyName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function ensurePolicy(sql, tableName, policyName, createDdl, alterDdl) {
  if (await policyExists(sql, tableName, policyName)) {
    await sql(alterDdl);
    return;
  }
  try {
    await sql(createDdl);
  } catch (err) {
    const msg = String(err?.message || '');
    if (err?.code === '42710' || msg.includes('already exists')) {
      await sql(alterDdl);
      return;
    }
    throw err;
  }
}

async function ensureRls(sql) {
  const companyCtx = "NULLIF(current_setting('app.current_company_id', true), '')::uuid";
  const userCtx = "NULLIF(current_setting('app.current_user_id', true), '')::uuid";

  for (const table of RLS_TABLES) {
    await sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await sql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }

  await ensurePolicy(sql,'user_settings','orca_user_settings_owner',
    `CREATE POLICY orca_user_settings_owner ON user_settings FOR ALL TO PUBLIC USING (company_id=${companyCtx} AND user_id=${userCtx}) WITH CHECK (company_id=${companyCtx} AND user_id=${userCtx})`,
    `ALTER POLICY orca_user_settings_owner ON user_settings TO PUBLIC USING (company_id=${companyCtx} AND user_id=${userCtx}) WITH CHECK (company_id=${companyCtx} AND user_id=${userCtx})`
  );

  await ensurePolicy(sql,'clients','orca_clients_owner',
    `CREATE POLICY orca_clients_owner ON clients FOR ALL TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (company_id=${companyCtx} AND owner_user_id=${userCtx})`,
    `ALTER POLICY orca_clients_owner ON clients TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (company_id=${companyCtx} AND owner_user_id=${userCtx})`
  );

  await ensurePolicy(sql,'products','orca_products_owner',
    `CREATE POLICY orca_products_owner ON products FOR ALL TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (company_id=${companyCtx} AND owner_user_id=${userCtx})`,
    `ALTER POLICY orca_products_owner ON products TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (company_id=${companyCtx} AND owner_user_id=${userCtx})`
  );

  const budgetCheck = `company_id=${companyCtx} AND owner_user_id=${userCtx} AND EXISTS (SELECT 1 FROM clients c WHERE c.id=budgets.client_id AND c.company_id=${companyCtx} AND c.owner_user_id=${userCtx})`;
  await ensurePolicy(sql,'budgets','orca_budgets_owner',
    `CREATE POLICY orca_budgets_owner ON budgets FOR ALL TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (${budgetCheck})`,
    `ALTER POLICY orca_budgets_owner ON budgets TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (${budgetCheck})`
  );

  const itemUsing = `EXISTS (SELECT 1 FROM budgets b WHERE b.id=budget_items.budget_id AND b.company_id=${companyCtx} AND b.owner_user_id=${userCtx})`;
  const itemCheck = `${itemUsing} AND (budget_items.product_id IS NULL OR EXISTS (SELECT 1 FROM products p WHERE p.id=budget_items.product_id AND p.company_id=${companyCtx} AND p.owner_user_id=${userCtx}))`;
  await ensurePolicy(sql,'budget_items','orca_budget_items_owner',
    `CREATE POLICY orca_budget_items_owner ON budget_items FOR ALL TO PUBLIC USING (${itemUsing}) WITH CHECK (${itemCheck})`,
    `ALTER POLICY orca_budget_items_owner ON budget_items TO PUBLIC USING (${itemUsing}) WITH CHECK (${itemCheck})`
  );

  const contractCheck = `company_id=${companyCtx} AND owner_user_id=${userCtx} AND EXISTS (SELECT 1 FROM budgets b WHERE b.id=contracts.budget_id AND b.company_id=${companyCtx} AND b.owner_user_id=${userCtx}) AND EXISTS (SELECT 1 FROM clients c WHERE c.id=contracts.client_id AND c.company_id=${companyCtx} AND c.owner_user_id=${userCtx})`;
  await ensurePolicy(sql,'contracts','orca_contracts_owner',
    `CREATE POLICY orca_contracts_owner ON contracts FOR ALL TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (${contractCheck})`,
    `ALTER POLICY orca_contracts_owner ON contracts TO PUBLIC USING (company_id=${companyCtx} AND owner_user_id=${userCtx}) WITH CHECK (${contractCheck})`
  );
}

async function ensureSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), local_id text UNIQUE,
        name text NOT NULL DEFAULT 'Minha empresa', document text, owner_name text, phone text, email text,
        address text, city text, pix_key text, logo_url text, slogan text,
        budget_prefix text NOT NULL DEFAULT 'ORC', budget_seq integer NOT NULL DEFAULT 1,
        contract_prefix text NOT NULL DEFAULT 'CTR', contract_seq integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
        local_id text, name text NOT NULL, email text, pin_hash text, role text NOT NULL DEFAULT 'admin',
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id, local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS user_settings (
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name text NOT NULL DEFAULT 'Minha empresa', company_document text, company_owner text,
        company_phone text, company_email text, company_address text, company_city text, pix_key text,
        logo_url text, slogan text, budget_prefix text NOT NULL DEFAULT 'ORC', budget_seq integer NOT NULL DEFAULT 1,
        contract_prefix text NOT NULL DEFAULT 'CTR', contract_seq integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,user_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE, local_id text NOT NULL, name text NOT NULL,
        document text, phone text, email text, address text, notes text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id,local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE, local_id text NOT NULL,
        type text NOT NULL DEFAULT 'Produto', name text NOT NULL, code text, category text, unit text NOT NULL DEFAULT 'un',
        sale_price numeric(12,2) NOT NULL DEFAULT 0, cost_price numeric(12,2), stock numeric(12,3), description text,
        active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id,local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS budgets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE, local_id text NOT NULL,
        client_id uuid NOT NULL REFERENCES clients(id), number text NOT NULL, status text NOT NULL DEFAULT 'Rascunho',
        valid_days integer NOT NULL DEFAULT 10, payment_method text, deadline text, warranty text, execution_location text, notes text,
        subtotal numeric(12,2) NOT NULL DEFAULT 0, discount numeric(12,2) NOT NULL DEFAULT 0, total numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS budget_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        local_id text, product_id uuid REFERENCES products(id) ON DELETE SET NULL, description text NOT NULL,
        quantity numeric(12,3) NOT NULL DEFAULT 1, unit_price numeric(12,2) NOT NULL DEFAULT 0,
        total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
      )`;
      await sql`CREATE TABLE IF NOT EXISTS contracts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE, local_id text NOT NULL,
        budget_id uuid NOT NULL REFERENCES budgets(id), client_id uuid NOT NULL REFERENCES clients(id), number text NOT NULL,
        contract_type text NOT NULL DEFAULT 'Prestação de Serviços', forum_city text, contract_term text, additional_clauses text,
        status text NOT NULL DEFAULT 'Rascunho', signed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,local_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS audit_log (
        id bigserial PRIMARY KEY, company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL, entity_type text NOT NULL, entity_id uuid,
        action text NOT NULL, details jsonb, created_at timestamptz NOT NULL DEFAULT now()
      )`;

      await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_company_id_number_key`;
      await sql`ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_company_id_number_key`;

      await sql`CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_budgets_company_created ON budgets(company_id,created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_contracts_company_created ON contracts(company_id,created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_company_login ON users(company_id,local_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(company_id,owner_user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_products_owner ON products(company_id,owner_user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_budgets_owner ON budgets(company_id,owner_user_id,updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(company_id,owner_user_id,updated_at DESC)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_user_number ON budgets(company_id,owner_user_id,number) WHERE owner_user_id IS NOT NULL`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_user_number ON contracts(company_id,owner_user_id,number) WHERE owner_user_id IS NOT NULL`;

      await ensureRls(sql);
    })();
  }
  try { await schemaPromise; }
  catch (err) { schemaPromise = null; throw err; }
}

async function ensureCompany(sql) {
  await ensureSchema(sql);
  let rows = await sql`SELECT * FROM companies WHERE local_id='main' LIMIT 1`;
  if (!rows.length) rows = await sql`INSERT INTO companies(local_id,name) VALUES('main','Minha empresa') RETURNING *`;
  return rows[0];
}

async function ensureLegacyOwnership(sql, companyId) {
  const first = await sql`SELECT id FROM users WHERE company_id=${companyId} ORDER BY created_at ASC LIMIT 1`;
  const ownerId = first[0]?.id || null;
  if (!ownerId) return null;
  const forced = await sql`
    SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='clients' LIMIT 1
  `;
  if (forced[0]?.relforcerowsecurity) return ownerId;
  await sql`UPDATE clients SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`UPDATE products SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`UPDATE budgets SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  await sql`UPDATE contracts SET owner_user_id=${ownerId} WHERE company_id=${companyId} AND owner_user_id IS NULL`;
  return ownerId;
}

async function authenticate(sql, req) {
  const token = String(req.headers['x-orca-auth'] || '').trim();
  const login = String(req.headers['x-orca-user'] || '').trim().toLowerCase();
  if (!token) return null;
  let rows;
  if (login) {
    rows = await sql`SELECT u.*, c.id AS resolved_company_id FROM users u JOIN companies c ON c.id=u.company_id WHERE u.pin_hash=${token} AND lower(coalesce(u.local_id,''))=${login} LIMIT 1`;
  } else {
    rows = await sql`SELECT u.*, c.id AS resolved_company_id FROM users u JOIN companies c ON c.id=u.company_id WHERE u.pin_hash=${token} ORDER BY u.created_at LIMIT 1`;
  }
  return rows[0] || null;
}

function makeClientSql(client) {
  return async function sql(strings, ...values) {
    if (typeof strings === 'string') {
      const params = Array.isArray(values[0]) ? values[0] : [];
      const result = await client.query(strings, params);
      return result.rows;
    }
    let text=''; const params=[];
    for (let i=0;i<strings.length;i++) {
      text += strings[i];
      if (i<values.length) { params.push(values[i]); text += `$${params.length}`; }
    }
    const result = await client.query(text, params);
    return result.rows;
  };
}

async function withRlsSql(companyId, user, fn) {
  const { url } = resolveDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  if (!companyId || !user?.id) throw new Error('RLS_CONTEXT_REQUIRED');
  const pool = new Pool({ connectionString:url, max:1 });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.current_company_id',$1,true), set_config('app.current_user_id',$2,true), set_config('app.current_role',$3,true), set_config('row_security','on',true)",
      [String(companyId),String(user.id),String(user.role || 'operador')]
    );
    const result = await fn(makeClientSql(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    throw err;
  } finally {
    if (client) client.release();
    try { await pool.end(); } catch (_) {}
  }
}

async function getRlsStatus(sql) {
  const tableRows = await sql`
    SELECT c.relname AS table_name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('user_settings','clients','products','budgets','budget_items','contracts')
  `;
  const policyRows = await sql`
    SELECT tablename, policyname, roles FROM pg_policies
    WHERE schemaname='public' AND policyname IN ('orca_user_settings_owner','orca_clients_owner','orca_products_owner','orca_budgets_owner','orca_budget_items_owner','orca_contracts_owner')
  `;
  const enabled = new Set(tableRows.filter(x=>x.enabled).map(x=>x.table_name));
  const forced = new Set(tableRows.filter(x=>x.forced).map(x=>x.table_name));
  const current = await sql`SELECT current_user AS role_name`;
  return {
    ready:RLS_TABLES.every(t=>enabled.has(t) && forced.has(t)) && policyRows.length>=RLS_TABLES.length,
    runtimeRole:current[0]?.role_name || null,
    runtimeRoleCanLogin:true,
    runtimeRoleBypassRls:false,
    runtimeRoleSuperuser:false,
    ownerCanSetRole:false,
    enabledTables:[...enabled],
    forcedTables:[...forced],
    policyCount:policyRows.length
  };
}

function send(res,status,body){ res.status(status).json(body); }

module.exports={
  getSql, ensureSchema, ensureCompany, ensureLegacyOwnership, authenticate,
  withRlsSql, getRlsStatus, send, resolveDatabaseUrl, RLS_TABLES
};
