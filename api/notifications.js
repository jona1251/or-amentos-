const { getSql, ensureCompany, authenticate, send } = require('./_db');
const { ensureNotificationsSchema, getPrimaryAdmin } = require('./_notifications');

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    const company = await ensureCompany(sql);
    await ensureNotificationsSchema(sql);
    const user = await authenticate(sql, req);
    if (!user) return send(res, 401, { ok:false, error:'UNAUTHORIZED' });

    const primary = await getPrimaryAdmin(sql, company.id);
    const isPrimaryAdmin = !!primary && String(primary.id) === String(user.id);
    if (!isPrimaryAdmin) return send(res, 403, { ok:false, error:'PRIMARY_ADMIN_ONLY', isPrimaryAdmin:false });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT n.id, n.kind, n.title, n.message, n.details, n.read_at, n.created_at,
               u.name AS actor_name, u.local_id AS actor_login
        FROM admin_notifications n
        LEFT JOIN users u ON u.id=n.actor_user_id
        WHERE n.company_id=${company.id} AND n.target_user_id=${user.id}
        ORDER BY n.created_at DESC
        LIMIT 60
      `;
      const unreadRows = await sql`
        SELECT count(*)::int AS total
        FROM admin_notifications
        WHERE company_id=${company.id} AND target_user_id=${user.id} AND read_at IS NULL
      `;
      return send(res, 200, {
        ok:true,
        isPrimaryAdmin:true,
        unread:Number(unreadRows[0]?.total || 0),
        notifications:rows.map(x=>({
          id:String(x.id), kind:x.kind, title:x.title, message:x.message,
          details:x.details || {}, readAt:x.read_at, createdAt:x.created_at,
          actorName:x.actor_name || '', actorLogin:x.actor_login || ''
        }))
      });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (action === 'mark_all_read') {
        await sql`
          UPDATE admin_notifications SET read_at=COALESCE(read_at,now())
          WHERE company_id=${company.id} AND target_user_id=${user.id} AND read_at IS NULL
        `;
        return send(res, 200, { ok:true });
      }
      if (action === 'mark_read') {
        const id = String(req.body?.id || '');
        if (!/^\d+$/.test(id)) return send(res, 400, { ok:false, error:'INVALID_NOTIFICATION' });
        await sql`
          UPDATE admin_notifications SET read_at=COALESCE(read_at,now())
          WHERE id=${id} AND company_id=${company.id} AND target_user_id=${user.id}
        `;
        return send(res, 200, { ok:true });
      }
      return send(res, 400, { ok:false, error:'INVALID_ACTION' });
    }

    return send(res, 405, { ok:false, error:'METHOD_NOT_ALLOWED' });
  } catch (err) {
    console.error('notifications', err);
    return send(res, 500, { ok:false, error:'SERVER_ERROR' });
  }
};
