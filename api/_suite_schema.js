const crypto = require('crypto');

let suiteSchemaPromise = null;

async function run(sql, text, params = []) {
  if (typeof sql?.query !== 'function') throw new Error('SQL_QUERY_API_UNAVAILABLE');
  const result = await sql.query(text, params);
  return result?.rows || result || [];
}

async function ensurePolicy(sql, table, policy, expression) {
  const rows = await sql`
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename=${table} AND policyname=${policy}
    LIMIT 1
  `;
  if (rows.length) {
    await run(sql, `ALTER POLICY ${policy} ON ${table} TO PUBLIC USING (${expression}) WITH CHECK (${expression})`);
  } else {
    await run(sql, `CREATE POLICY ${policy} ON ${table} FOR ALL TO PUBLIC USING (${expression}) WITH CHECK (${expression})`);
  }
}

async function ensureSuiteSchema(sql) {
  if (!suiteSchemaPromise) {
    suiteSchemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS business_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind text NOT NULL,
        local_id text NOT NULL,
        title text,
        status text,
        amount numeric(14,2),
        due_date date,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        favorite boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(company_id, owner_user_id, kind, local_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS suite_activity (
        id bigserial PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        entity_kind text,
        entity_local_id text,
        action text NOT NULL,
        details jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_permissions (
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(company_id,user_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_security (
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        totp_secret text,
        totp_enabled boolean NOT NULL DEFAULT false,
        recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(company_id,user_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS suite_public_links (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token text NOT NULL UNIQUE,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        link_type text NOT NULL,
        entity_kind text NOT NULL,
        entity_local_id text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        expires_at timestamptz,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS suite_signatures (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entity_kind text NOT NULL,
        entity_local_id text NOT NULL,
        signer_name text,
        signature_data text NOT NULL,
        ip text,
        user_agent text,
        signed_at timestamptz NOT NULL DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS suite_backups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label text,
        snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;

      await sql`CREATE INDEX IF NOT EXISTS idx_business_records_kind ON business_records(company_id,owner_user_id,kind,updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_business_records_deleted ON business_records(company_id,owner_user_id,deleted_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_suite_activity_user ON suite_activity(company_id,user_id,created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_suite_public_links_token ON suite_public_links(token)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_suite_signatures_entity ON suite_signatures(company_id,owner_user_id,entity_kind,entity_local_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_suite_backups_user ON suite_backups(company_id,owner_user_id,created_at DESC)`;

      await run(sql, 'ALTER TABLE business_records ENABLE ROW LEVEL SECURITY');
      await run(sql, 'ALTER TABLE business_records FORCE ROW LEVEL SECURITY');
      await run(sql, 'ALTER TABLE suite_signatures ENABLE ROW LEVEL SECURITY');
      await run(sql, 'ALTER TABLE suite_signatures FORCE ROW LEVEL SECURITY');
      await run(sql, 'ALTER TABLE suite_backups ENABLE ROW LEVEL SECURITY');
      await run(sql, 'ALTER TABLE suite_backups FORCE ROW LEVEL SECURITY');

      const companyCtx = "NULLIF(current_setting('app.current_company_id', true), '')::uuid";
      const userCtx = "NULLIF(current_setting('app.current_user_id', true), '')::uuid";
      const expr = `company_id=${companyCtx} AND owner_user_id=${userCtx}`;
      await ensurePolicy(sql, 'business_records', 'orca_business_records_owner', expr);
      await ensurePolicy(sql, 'suite_signatures', 'orca_suite_signatures_owner', expr);
      await ensurePolicy(sql, 'suite_backups', 'orca_suite_backups_owner', expr);

      try {
        await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip text`;
        await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent text`;
        await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_name text`;
      } catch (_) {}
    })();
  }
  try { await suiteSchemaPromise; }
  catch (err) { suiteSchemaPromise = null; throw err; }
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', out = '';
  for (const b of buffer) bits += b.toString(2).padStart(8,'0');
  for (let i=0;i<bits.length;i+=5) out += alphabet[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];
  return out;
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input||'').replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits='';
  for (const ch of clean) {
    const n=alphabet.indexOf(ch);
    if(n>=0) bits+=n.toString(2).padStart(5,'0');
  }
  const bytes=[];
  for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  return Buffer.from(bytes);
}

function generateTotpSecret() { return base32Encode(crypto.randomBytes(20)); }
function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  let c = BigInt(counter);
  for (let i=7;i>=0;i--) { buf[i]=Number(c & 255n); c >>= 8n; }
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = h[h.length-1] & 15;
  const n = ((h[offset]&127)<<24)|((h[offset+1]&255)<<16)|((h[offset+2]&255)<<8)|(h[offset+3]&255);
  return String(n % 1000000).padStart(6,'0');
}
function verifyTotp(secret, code, windowSize=1) {
  const token=String(code||'').replace(/\D/g,'');
  if(!/^\d{6}$/.test(token)||!secret) return false;
  const step=Math.floor(Date.now()/30000);
  for(let w=-windowSize;w<=windowSize;w++) if(hotp(secret,step+w)===token) return true;
  return false;
}

module.exports = { ensureSuiteSchema, generateTotpSecret, verifyTotp };
