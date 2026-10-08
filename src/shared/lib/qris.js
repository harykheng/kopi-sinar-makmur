// EMV QRIS static→dynamic conversion. Deterministic, same input always
// produces the same output, so a QR can be regenerated any time from the
// same amount without expiry or a payment gateway. Ported verbatim from
// the original js/catalog.js; do not change this logic.

export function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function qrisToDynamic(staticQris, amount) {
  // Remove the 4-char CRC value at the end (keep "6304" for recalculation)
  let data = staticQris.slice(0, -4);
  // Change Point of Initiation Method: 11 (static) → 12 (dynamic)
  data = data.replace('010211', '010212');
  // Insert Transaction Amount field (tag 54) before Country Code (tag 5802)
  const amountStr = String(amount);
  data = data.replace('5802ID', `54${String(amountStr.length).padStart(2, '0')}${amountStr}5802ID`);
  // Recalculate CRC, data already ends with '6304' tag+length
  return data + crc16(data);
}
