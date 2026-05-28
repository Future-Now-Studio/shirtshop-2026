// Netlify Function V2 – sends contact form email via SMTP.

import nodemailer from 'nodemailer';

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

function escapeHtml(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    let name, email, phone, message;
    const attachments = [];

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      name = fd.get('name');
      email = fd.get('email');
      phone = fd.get('phone') || '';
      message = fd.get('message');

      for (const [key, value] of fd.entries()) {
        if (key.startsWith('file_') && value instanceof File && value.size > 0) {
          const buf = Buffer.from(await value.arrayBuffer());
          attachments.push({ filename: value.name, content: buf });
        }
      }
    } else {
      ({ name, email, phone, message } = await req.json());
    }

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and message are required' }),
        { status: 400, headers },
      );
    }

    const smtpUser = process.env.SMTP_USER || process.env.WP_EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.WP_EMAIL_PASS;
    if (!smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), { status: 500, headers });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.timob10.sg-host.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || '');
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
        ${attachments.length > 0 ? `<p><strong>Anhänge:</strong> ${attachments.map(a => escapeHtml(a.filename)).join(', ')}</p>` : ''}
        <hr>
        <p style="color:#666;font-size:12px;">Diese E-Mail wurde über private-shirt.de gesendet.</p>
      `,
      text: `Neue Anfrage\n\nName: ${name}\nE-Mail: ${email}\n${phone ? `Telefon: ${phone}\n` : ''}\nNachricht:\n${message}\n`,
      attachments,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error('send-contact-email error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email', success: false }),
      { status: 500, headers },
    );
  }
};

export const config = { path: '/api/send-contact-email' };
