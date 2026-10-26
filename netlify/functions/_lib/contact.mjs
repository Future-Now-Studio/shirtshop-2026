// Shared validation helpers for the contact form (Netlify function + server.js).

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_ATTACHMENTS = 5;

/** Recipient of form mails: CONTACT_EMAIL_TO, else the company inbox from the Impressum. */
export function contactRecipient(env = process.env) {
  return env.CONTACT_EMAIL_TO || 'info@private-shirt.de';
}

const ALLOWED_ATTACHMENT_TYPES = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/gif', ['.gif']],
  ['image/webp', ['.webp']],
  ['application/pdf', ['.pdf']],
]);

export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Single-line text: strip control chars (prevents header injection), trim, cap length. */
export function cleanLine(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().substring(0, max);
}

export function cleanMultiline(value, max = 10000) {
  if (typeof value !== 'string') return '';
  // keep \n and \t, drop other control characters
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().substring(0, max);
}

/** A plain address like "name@example.com" – no display name, no lists, no CR/LF. */
export function isPlainEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(value);
}

/** Honeypot: the hidden "website" field must stay empty. */
export function isHoneypotTriggered(value) {
  return typeof value === 'string' ? value.trim() !== '' : value != null && value !== '';
}

function sniffType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('latin1') === 'GIF87a' || buf.subarray(0, 6).toString('latin1') === 'GIF89a')) return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

/**
 * Validates one attachment. Returns a nodemailer attachment or throws Error with a user-facing message.
 * Type is decided by the file's magic bytes; the declared MIME type and extension must agree.
 */
export function validateAttachment({ filename, contentType, content }) {
  if (!Buffer.isBuffer(content) || content.length === 0) throw new Error('Leerer Anhang');
  if (content.length > MAX_ATTACHMENT_BYTES) throw new Error('Anhang ist größer als 10 MB');
  const detected = sniffType(content);
  if (!detected) throw new Error('Nur Bilder (JPG, PNG, GIF, WEBP) oder PDF sind erlaubt');
  const declared = typeof contentType === 'string' ? contentType.split(';')[0].trim().toLowerCase() : '';
  if (declared && declared !== 'application/octet-stream' && declared !== detected) {
    throw new Error('Dateityp stimmt nicht mit dem Inhalt überein');
  }
  const exts = ALLOWED_ATTACHMENT_TYPES.get(detected);
  const safeBase = cleanLine(String(filename || 'anhang'), 100).replace(/[^A-Za-z0-9._ -]/g, '_') || 'anhang';
  const hasAllowedExt = exts.some((ext) => safeBase.toLowerCase().endsWith(ext));
  return {
    filename: hasAllowedExt ? safeBase : `${safeBase}${exts[0]}`,
    content,
    contentType: detected,
  };
}
