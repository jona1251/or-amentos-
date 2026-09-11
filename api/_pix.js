function clean(value, max) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, '')
    .trim().toUpperCase().slice(0, max);
}

function tlv(id, value) {
  const v = String(value ?? '');
  return id + String(v.length).padStart(2, '0') + v;
}

function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload({ key, merchantName, merchantCity, amount, description, txid='***' }) {
  if (!String(key || '').trim()) return '';
  const account = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', String(key).trim()) + (description ? tlv('02', clean(description, 72)) : '');
  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('26', account);
  payload += tlv('52', '0000');
  payload += tlv('53', '986');
  if (Number(amount) > 0) payload += tlv('54', Number(amount).toFixed(2));
  payload += tlv('58', 'BR');
  payload += tlv('59', clean(merchantName || 'ORCAFACIL', 25) || 'ORCAFACIL');
  payload += tlv('60', clean(merchantCity || 'SAO PAULO', 15) || 'SAO PAULO');
  payload += tlv('62', tlv('05', clean(txid || '***', 25) || '***'));
  payload += '6304';
  return payload + crc16(payload);
}

module.exports = { buildPixPayload };
