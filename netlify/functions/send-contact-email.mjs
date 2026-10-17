// Netlify Function V2 – sends contact form email via SMTP.

import nodemailer from 'nodemailer';
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  cleanLine,
  cleanMultiline,
  escapeHtml,
  isHoneypotTriggered,
  isPlainEmail,
  validateAttachment,
} from './_lib/contact.mjs';

const ALLOWED_ORIGINS = [
  'https://private-shirt.de',
  'https://www.private-shirt.de',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers });

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' }, headers);

  try {
    let fields;
    const attachments = [];

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      fields = {
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        message: fd.get('message'),
        website: fd.get('website'),
      };

      for (const [key, value] of fd.entries()) {
        if (!key.startsWith('file_') || !(value instanceof File) || value.size === 0) continue;
        if (attachments.length >= MAX_ATTACHMENTS) {
          return json(400, { error: `Maximal ${MAX_ATTACHMENTS} Anhänge erlaubt` }, headers);
        }
        if (value.size > MAX_ATTACHMENT_BYTES) {
          return json(400, { error: 'Anhang ist größer als 10 MB' }, headers);
        }
        try {
          attachments.push(validateAttachment({
            filename: value.name,
            contentType: value.type,
            content: Buffer.from(await value.arrayBuffer()),
          }));
        } catch (err) {
          return json(400, { error: err.message }, headers);
        }
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') return json(400, { error: 'Invalid request' }, headers);
      fields = body;
    }

    // Honeypot: bots fill the hidden "website" field. Pretend success, send nothing.
    if (isHoneypotTriggered(fields.website)) {
      return json(200, { success: true }, headers);
    }

    const name = cleanLine(fields.name, 200);
    const email = cleanLine(fields.email, 254);
    const phone = cleanLine(fields.phone, 50);
    const message = cleanMultiline(fields.message, 10000);

    if (!name || !email || !message) {
      return json(400, { error: 'Name, email, and message are required' }, headers);
    }
    if (!isPlainEmail(email)) {
      return json(400, { error: 'Bitte geben Sie eine gültige E-Mail-Adresse an' }, headers);
    }

    const smtpUser = process.env.SMTP_USER || process.env.WP_EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.WP_EMAIL_PASS;
    if (!smtpUser || !smtpPass) {
      return json(500, { error: 'SMTP not configured' }, headers);
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.timob10.sg-host.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const subject = attachments.length > 0
      ? `Neue Grossbestellung von ${name} (${attachments.length} Anhang${attachments.length > 1 ? 'e' : ''})`
      : `Neue Kontaktanfrage von ${name}`;

    const info = await transporter.sendMail({
      from: `"Private Shirt Kontaktformular" <${process.env.SMTP_FROM || smtpUser}>`,
      to: process.env.CONTACT_EMAIL_TO || 'timobeyer_@outlook.de',
      replyTo: email,
      subject,
      html: `
        <h2>Neue Anfrage</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>E-Mail:</strong> ${safeEmail}</p>
        ${safePhone ? `<p><strong>Telefon:</strong> ${safePhone}</p>` : ''}
        <p><strong>Nachricht:</strong></p>
        <pre style="background:#f5f5f5;padding:12px;border-radius:4px;white-space:pre-wrap">${safeMessage}</pre>
        ${attachments.length > 0 ? `<p><strong>Anhänge:</strong> ${attachments.map((a) => escapeHtml(a.filename)).join(', ')}</p>` : ''}
        <hr>
        <p style="color:#666;font-size:12px;">Diese E-Mail wurde über private-shirt.de gesendet.</p>
      `,
      text: `Neue Anfrage\n\nName: ${name}\nE-Mail: ${email}\n${phone ? `Telefon: ${phone}\n` : ''}\nNachricht:\n${message}\n`,
      attachments,
    });

    return json(200, { success: true, messageId: info.messageId }, headers);
  } catch (error) {
    console.error('send-contact-email error:', error);
    return json(500, { error: 'Failed to send email', success: false }, headers);
  }
};

export const config = { path: '/api/send-contact-email' };
