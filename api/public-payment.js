const QRCode=require('qrcode');
const {getSql,withRlsSql,send}=require('./_db');
const {ensureSuiteSchema}=require('./_suite_schema');
const {buildPixPayload}=require('./_pix');

const e=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const valid=v=>/^[a-f0-9]{48}$/i.test(String(v||''));
function safeExternalUrl(v){try{const u=new URL(String(v||''));return ['https:','http:'].includes(u.protocol)?u.toString():''}catch(_){return ''}}
function headers(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self' data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")}

module.exports=async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    const token=String(req.query?.token||'');if(!valid(token))return send(res,404,{ok:false,error:'LINK_NOT_FOUND'});
    const sql=getSql();await ensureSuiteSchema(sql);
    const rows=await sql`SELECT * FROM suite_public_links WHERE token=${token} AND link_type='payment' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`;
    const link=rows[0];if(!link)return send(res,404,{ok:false,error:'LINK_NOT_FOUND'});
    const data=await withRlsSql(link.company_id,{id:link.owner_user_id,role:'operador'},async rls=>{
      const s=await rls`SELECT company_name,company_city,company_phone,company_email,pix_key,logo_url,slogan FROM user_settings WHERE company_id=${link.company_id} AND user_id=${link.owner_user_id} LIMIT 1`;
      let amount=Number(link.payload?.amount||0),title=String(link.payload?.title||'Pagamento').slice(0,180),clientName=String(link.payload?.clientName||'').slice(0,180);
      if(link.entity_kind==='budget'){
        const b=await rls`SELECT b.number,b.total,c.name client_name FROM budgets b JOIN clients c ON c.id=b.client_id WHERE b.company_id=${link.company_id} AND b.owner_user_id=${link.owner_user_id} AND b.local_id=${link.entity_local_id} LIMIT 1`;
        if(b[0]){amount=Number(b[0].total||amount);title='Orçamento '+b[0].number;clientName=b[0].client_name||clientName}
      }
      return {settings:s[0]||{},amount:Math.max(0,amount),title,clientName};
    });
    let payload='',qr='';
    if(data.settings.pix_key){payload=buildPixPayload({key:data.settings.pix_key,merchantName:data.settings.company_name,merchantCity:data.settings.company_city,amount:data.amount,description:data.title,txid:String(link.entity_local_id||'PAG').replace(/[^A-Za-z0-9]/g,'').slice(0,25)||'***'});qr=await QRCode.toDataURL(payload,{width:300,margin:1,errorCorrectionLevel:'M'})}
    const external=safeExternalUrl(link.payload?.externalUrl);
    const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(data.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#172033;font-family:Arial,sans-serif;min-height:100vh}.wrap{width:min(94vw,680px);margin:28px auto}.card{background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.08)}.brand{display:flex;gap:14px;align-items:center}.logo{width:58px;height:58px;border-radius:17px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden}.logo img{width:100%;height:100%;object-fit:contain;background:#fff}h1{font-size:25px;margin:24px 0 6px}.muted{color:#64748b}.amount{font-size:38px;font-weight:900;margin:18px 0}.qr{display:block;width:min(300px,85vw);margin:20px auto}.code{font-size:11px;word-break:break-all;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:13px}.btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:14px;background:#067647;color:#fff;font-weight:900;padding:14px 18px;cursor:pointer;text-decoration:none;width:100%;margin-top:12px}.ext{background:#111827}.notice{padding:12px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:800;margin-top:14px}</style></head><body><div class="wrap"><div class="card"><div class="brand"><div class="logo">${data.settings.logo_url?`<img src="${e(data.settings.logo_url)}" alt="Logo">`:e(String(data.settings.company_name||'OF').slice(0,2).toUpperCase())}</div><div><b>${e(data.settings.company_name||'Empresa')}</b><div class="muted">${e(data.settings.slogan||'Pagamento seguro')}</div></div></div><h1>${e(data.title)}</h1>${data.clientName?`<div class="muted">Cliente: ${e(data.clientName)}</div>`:''}<div class="amount">${money(data.amount)}</div>${qr?`<img class="qr" src="${qr}" alt="QR Code PIX"><div class="code" id="pix">${e(payload)}</div><button class="btn" onclick="copyPix(this)">Copiar PIX</button>`:'<div class="notice">A empresa ainda não configurou uma chave PIX.</div>'}${external?`<a class="btn ext" href="${e(external)}" rel="noopener noreferrer">Abrir link do provedor de pagamento</a>`:''}<div class="muted" style="margin-top:18px;font-size:11px">Este link foi criado pelo OrçaFácil Pro. Confirme os dados da empresa antes de pagar.</div></div></div><script>async function copyPix(btn){try{await navigator.clipboard.writeText(document.getElementById('pix').textContent);btn.textContent='PIX copiado ✓'}catch(_){alert('Selecione e copie o código PIX manualmente.')}}</script></body></html>`;
    headers(res);res.status(200).setHeader('Content-Type','text/html; charset=utf-8');return res.send(html);
  }catch(err){console.error('public-payment',err);return send(res,500,{ok:false,error:'SERVER_ERROR'})}
};
