const QRCode = require('qrcode');
const { getSql, withRlsSql, send } = require('./_db');
const { ensurePremiumSchema } = require('./_premium_schema');
const { buildPixPayload } = require('./_pix');

function e(v) {
  return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function money(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0)); }
function validToken(v) { return /^[a-f0-9]{48}$/i.test(String(v || '')); }

async function loadPublicData(adminSql, link) {
  return withRlsSql(link.company_id, { id:link.owner_user_id, role:'operador' }, async sql => {
    const rows = await sql`
      SELECT b.id, b.local_id, b.number, b.status, b.valid_days, b.payment_method, b.deadline,
             b.notes, b.subtotal, b.discount, b.total, b.created_at,
             c.name AS client_name,
             s.company_name, s.company_phone, s.company_email, s.company_city, s.company_address,
             s.logo_url, s.slogan, s.pix_key
      FROM budgets b
      JOIN clients c ON c.id=b.client_id
      LEFT JOIN user_settings s ON s.company_id=b.company_id AND s.user_id=b.owner_user_id
      WHERE b.id=${link.budget_id} AND b.company_id=${link.company_id} AND b.owner_user_id=${link.owner_user_id}
      LIMIT 1
    `;
    if (!rows.length) return null;
    const items = await sql`
      SELECT description, quantity, unit_price, total
      FROM budget_items WHERE budget_id=${link.budget_id} ORDER BY id
    `;
    return { ...rows[0], items };
  });
}

function resultPage(title, message) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)}</title><style>body{margin:0;background:#f3f5f8;font-family:Inter,Arial,sans-serif;color:#172033;display:grid;min-height:100vh;place-items:center}.box{width:min(92vw,560px);background:white;border:1px solid #e5e7eb;border-radius:22px;padding:30px;box-shadow:0 18px 50px rgba(15,23,42,.08);text-align:center}h1{font-size:24px;margin:0 0 10px}p{color:#64748b;line-height:1.6}.ok{font-size:46px}</style></head><body><div class="box"><div class="ok">✓</div><h1>${e(title)}</h1><p>${e(message)}</p></div></body></html>`;
}

module.exports = async function handler(req, res) {
  try {
    const token = String(req.query?.token || '');
    if (!validToken(token)) return send(res, 404, { ok:false, error:'LINK_NOT_FOUND' });
    const adminSql = getSql();
    await ensurePremiumSchema(adminSql);
    const links = await adminSql`
      SELECT token, company_id, owner_user_id, budget_id, response_status
      FROM public_budget_links WHERE token=${token} LIMIT 1
    `;
    const link = links[0];
    if (!link) return send(res, 404, { ok:false, error:'LINK_NOT_FOUND' });

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (!['approve','reject'].includes(action)) return send(res, 400, { ok:false, error:'INVALID_ACTION' });
      const status = action === 'approve' ? 'Aprovado' : 'Recusado';
      const changed = await withRlsSql(link.company_id, { id:link.owner_user_id, role:'operador' }, async sql => {
        const budgets = await sql`
          UPDATE budgets SET status=${status}, updated_at=now()
          WHERE id=${link.budget_id} AND company_id=${link.company_id} AND owner_user_id=${link.owner_user_id}
          RETURNING id, total
        `;
        if (!budgets.length) return false;
        if (action === 'approve') {
          await sql`
            INSERT INTO receivables(company_id, owner_user_id, budget_id, amount, status, updated_at)
            VALUES(${link.company_id}, ${link.owner_user_id}, ${link.budget_id}, ${Number(budgets[0].total||0)}, 'Pendente', now())
            ON CONFLICT (company_id, owner_user_id, budget_id)
            DO UPDATE SET amount=EXCLUDED.amount, updated_at=now()
          `;
        }
        return true;
      });
      if (!changed) return send(res, 404, { ok:false, error:'BUDGET_NOT_FOUND' });
      await adminSql`
        UPDATE public_budget_links
        SET responded_at=now(), response_status=${status}
        WHERE token=${token}
      `;
      return send(res, 200, { ok:true, status });
    }

    if (req.method !== 'GET') return send(res, 405, { ok:false, error:'METHOD_NOT_ALLOWED' });
    const data = await loadPublicData(adminSql, link);
    if (!data) return send(res, 404, { ok:false, error:'BUDGET_NOT_FOUND' });

    await adminSql`UPDATE public_budget_links SET viewed_at=COALESCE(viewed_at,now()) WHERE token=${token}`;
    await withRlsSql(link.company_id, { id:link.owner_user_id, role:'operador' }, async sql => {
      await sql`
        UPDATE budgets
        SET status=CASE WHEN status IN ('Rascunho','Enviado') THEN 'Visualizado' ELSE status END, updated_at=now()
        WHERE id=${link.budget_id} AND company_id=${link.company_id} AND owner_user_id=${link.owner_user_id}
      `;
    });

    let pixPayload = '', qr = '';
    if (data.pix_key) {
      pixPayload = buildPixPayload({
        key:data.pix_key,
        merchantName:data.company_name,
        merchantCity:data.company_city,
        amount:data.total,
        description:`Orcamento ${data.number}`,
        txid:String(data.number||'ORC').replace(/[^A-Za-z0-9]/g,'').slice(0,25)||'***'
      });
      qr = await QRCode.toDataURL(pixPayload,{width:260,margin:1,errorCorrectionLevel:'M'});
    }

    const already = link.response_status;
    const rows = data.items.map(i => `<tr><td>${e(i.description)}</td><td>${Number(i.quantity||0)}</td><td>${money(i.unit_price)}</td><td>${money(i.total)}</td></tr>`).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orçamento ${e(data.number)}</title><style>
      *{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#172033;font-family:Inter,Arial,sans-serif}.wrap{width:min(94vw,900px);margin:30px auto}.card{background:white;border:1px solid #e5e7eb;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.07);margin-bottom:18px}.head{display:flex;gap:16px;align-items:center;justify-content:space-between}.brand{display:flex;gap:14px;align-items:center}.logo{width:56px;height:56px;border-radius:16px;background:#111827;color:white;display:grid;place-items:center;font-weight:900;overflow:hidden}.logo img{width:100%;height:100%;object-fit:contain;background:white}.muted{color:#64748b}.num{text-align:right}.num small{display:block;color:#64748b;font-size:11px;font-weight:800}.num strong{font-size:22px}.client{display:flex;justify-content:space-between;gap:18px;padding:18px 0;border-top:1px solid #eef2f7;border-bottom:1px solid #eef2f7;margin:22px 0}.client small{display:block;color:#64748b;font-size:11px;font-weight:800;margin-bottom:4px}table{width:100%;border-collapse:collapse}th,td{padding:12px 8px;border-bottom:1px solid #eef2f7;text-align:left}th{font-size:11px;color:#64748b;text-transform:uppercase}th:last-child,td:last-child{text-align:right}.summary{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-top:24px}.total{text-align:right}.total small{display:block;color:#64748b;font-weight:800}.total strong{font-size:32px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.btn{border:0;border-radius:14px;padding:14px 18px;font-weight:900;cursor:pointer;font-size:15px}.approve{background:#067647;color:white}.reject{background:#fff1f2;color:#b42318;border:1px solid #fecdd3}.pix{display:grid;grid-template-columns:190px 1fr;gap:22px;align-items:center}.pix img{width:190px;height:190px}.payload{font-size:11px;word-break:break-all;background:#f8fafc;border:1px solid #e5e7eb;padding:12px;border-radius:12px}.notice{padding:13px 15px;border-radius:14px;background:#ecfdf3;color:#067647;font-weight:800;margin-top:18px}@media(max-width:640px){.wrap{margin:12px auto}.card{padding:20px;border-radius:18px}.head,.summary,.client{align-items:flex-start}.client,.summary{flex-direction:column}.num{text-align:left}.pix{grid-template-columns:1fr;text-align:center}.pix img{margin:auto}.actions .btn{flex:1}.tableWrap{overflow:auto}table{min-width:560px}}
    </style></head><body><div class="wrap"><div class="card"><div class="head"><div class="brand"><div class="logo">${data.logo_url?`<img src="${e(data.logo_url)}" alt="Logo">`:e(String(data.company_name||'OF').slice(0,2).toUpperCase())}</div><div><strong>${e(data.company_name||'Empresa')}</strong><div class="muted">${e(data.slogan||'Orçamento profissional')}</div></div></div><div class="num"><small>ORÇAMENTO</small><strong>${e(data.number)}</strong></div></div><div class="client"><div><small>CLIENTE</small><strong>${e(data.client_name)}</strong></div><div><small>VALIDADE</small><strong>${Number(data.valid_days||10)} dias</strong></div><div><small>PAGAMENTO</small><strong>${e(data.payment_method||'A combinar')}</strong></div></div><div class="tableWrap"><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div><div class="summary"><div class="muted">${data.deadline?`Prazo: ${e(data.deadline)}<br>`:''}${data.notes?e(data.notes):''}</div><div class="total"><small>VALOR TOTAL</small><strong>${money(data.total)}</strong></div></div>${already?`<div class="notice">Este orçamento já foi ${e(already.toLowerCase())}.</div>`:`<div class="actions"><button class="btn approve" onclick="respond('approve')">✓ Aprovar orçamento</button><button class="btn reject" onclick="respond('reject')">Recusar</button></div>`}</div>${qr?`<div class="card pix"><img src="${qr}" alt="QR Code PIX"><div><h2>Pagar com PIX</h2><p class="muted">Escaneie o QR Code ou copie o código PIX.</p><div class="payload" id="pixcode">${e(pixPayload)}</div><div class="actions"><button class="btn approve" onclick="navigator.clipboard.writeText(document.getElementById('pixcode').textContent);this.textContent='Código copiado ✓'">Copiar PIX</button></div></div></div>`:''}</div><script>async function respond(action){if(!confirm(action==='approve'?'Aprovar este orçamento?':'Recusar este orçamento?'))return;const buttons=document.querySelectorAll('.actions button');buttons.forEach(b=>b.disabled=true);try{const r=await fetch(location.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha');document.body.innerHTML=${JSON.stringify(resultPage('Resposta registrada','Obrigado. A empresa recebeu sua resposta.'))};}catch(e){alert('Não foi possível registrar sua resposta. Tente novamente.');buttons.forEach(b=>b.disabled=false)}}</script></body></html>`;
    res.status(200).setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    return res.send(html);
  } catch (err) {
    console.error('public-budget', err);
    return send(res, 500, { ok:false, error:'SERVER_ERROR' });
  }
};
