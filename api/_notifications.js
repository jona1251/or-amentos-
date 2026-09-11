async function ensureNotificationsSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS admin_notifications (
    id bigserial PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    kind text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    details jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_target ON admin_notifications(company_id,target_user_id,created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(company_id,target_user_id,read_at) WHERE read_at IS NULL`;
}

async function getPrimaryAdmin(sql, companyId) {
  const rows = await sql`
    SELECT id, name, local_id, role
    FROM users
    WHERE company_id=${companyId} AND role='admin'
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0] || null;
}

function requestInfo(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  const ip = (forwarded || realIp || '').slice(0,120);
  const userAgent = String(req.headers['user-agent'] || '').slice(0,500);
  return { ip, userAgent };
}

async function notifyPrimaryAdminOfLogin(sql, companyId, user, req) {
  await ensureNotificationsSchema(sql);
  const primary = await getPrimaryAdmin(sql, companyId);
  if (!primary || String(primary.id) === String(user.id)) return null;

  const info = requestInfo(req);
  const login = String(user.local_id || '').trim();
  const name = String(user.name || login || 'Usuário').trim();
  const title = 'Usuário acessou o sistema';
  const message = `${name}${login ? ` (@${login})` : ''} entrou no OrçaFácil Pro.`;

  const rows = await sql`
    INSERT INTO admin_notifications(company_id,target_user_id,actor_user_id,kind,title,message,details)
    VALUES(${companyId},${primary.id},${user.id},'user_login',${title},${message},${JSON.stringify(info)}::jsonb)
    RETURNING id, created_at
  `;

  try {
    await sql`
      INSERT INTO audit_log(company_id,user_id,entity_type,entity_id,action,details)
      VALUES(${companyId},${user.id},'user',${user.id},'login_success',${JSON.stringify({ login, ...info })}::jsonb)
    `;
  } catch (_) {}

  return rows[0] || null;
}

module.exports = { ensureNotificationsSchema, getPrimaryAdmin, notifyPrimaryAdminOfLogin };
