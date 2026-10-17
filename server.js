// Local Express dev server for the legacy shop (Stripe + WooCommerce + contact mail).
// Run with: npm run server
// Production uses the Netlify functions in netlify/functions/, which share the same
// pricing / checkout / contact logic from netlify/functions/_lib/.

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { getWcConfig } from './netlify/functions/_lib/pricing.mjs';
import { createOrderFromPayment, createPaymentIntentForCart } from './netlify/functions/_lib/checkout.mjs';
import {
  cleanLine,
  cleanMultiline,
  escapeHtml,
  isHoneypotTriggered,
  isPlainEmail,
} from './netlify/functions/_lib/contact.mjs';

// Load environment variables
dotenv.config();

// WooCommerce configuration – credentials come from the environment only.
const missingWc = ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'].filter((k) => !process.env[k]);
if (missingWc.length > 0) {
  console.error(`❌ Missing required environment variable(s): ${missingWc.join(', ')}`);
  console.error('   Add them to .env (see README.md). WC_BASE_URL is the REST root, e.g. https://shop.example/wp-json/wc/v3');
  process.exit(1);
}
const wc = getWcConfig(process.env);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe with secret key from .env
// Only instantiate when a key is present – otherwise the server still starts (Stripe endpoints return 500)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Stripe webhook – MUST be registered before express.json() so the raw body is
// available for signature verification.
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error('Webhook rejected: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    // Frontend creates the WC order via /api/create-order; this log helps reconcile
    // if the browser flow dies between payment success and order creation.
    console.log('payment_intent.succeeded:', pi.id, 'amount:', pi.amount, 'cart:', pi.metadata?.cart_hash);
  }

  res.json({ received: true });
});

// Body parsers for all other routes.
// Large limit because checkout payloads carry the custom design images.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Stripe backend server is running' });
});

// Create PaymentIntent – amount is recomputed server-side from WooCommerce prices.
app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe secret key not configured' });
  }
  const result = await createPaymentIntentForCart({ stripe, wc, items: req.body?.items });
  res.status(result.status).json(result.body);
});

// Create WooCommerce order – only after the PaymentIntent is verified with Stripe.
app.post('/api/create-order', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe secret key not configured', success: false });
  }
  const result = await createOrderFromPayment({ stripe, wc, body: req.body || {} });
  res.status(result.status).json(result.body);
});

// Contact form email endpoint
app.post('/api/send-contact-email', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Honeypot: bots fill the hidden "website" field. Pretend success, send nothing.
    if (isHoneypotTriggered(body.website)) {
      return res.json({ success: true });
    }

    const name = cleanLine(body.name, 200);
    const email = cleanLine(body.email, 254);
    const phone = cleanLine(body.phone, 50);
    const message = cleanMultiline(body.message, 10000);

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }
    if (!isPlainEmail(email)) {
      return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse an' });
    }

    const smtpUser = process.env.SMTP_USER || process.env.WP_EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.WP_EMAIL_PASS;
    if (!smtpUser || !smtpPass) {
      return res.status(500).json({ error: 'SMTP not configured' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.timob10.sg-host.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: { user: smtpUser, pass: smtpPass },
    });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const info = await transporter.sendMail({
      from: `"Private Shirt Contact Form" <${process.env.SMTP_FROM || smtpUser}>`,
      to: process.env.CONTACT_EMAIL_TO || 'timobeyer_@outlook.de',
      replyTo: email,
      subject: `Neue Kontaktanfrage von ${name}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>E-Mail:</strong> ${safeEmail}</p>
        ${safePhone ? `<p><strong>Telefon:</strong> ${safePhone}</p>` : ''}
        <p><strong>Nachricht:</strong></p>
        <p>${safeMessage}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Diese E-Mail wurde über das Kontaktformular auf private-shirt.de gesendet.
        </p>
      `,
      text: `Neue Kontaktanfrage\n\nName: ${name}\nE-Mail: ${email}\n${phone ? `Telefon: ${phone}\n` : ''}\nNachricht:\n${message}\n\n---\nDiese E-Mail wurde über das Kontaktformular auf private-shirt.de gesendet.\n`,
    });

    console.log('Contact email sent:', info.messageId);
    res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res.status(500).json({ error: 'Failed to send email', success: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Stripe backend server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoint: http://localhost:${PORT}/api/create-payment-intent`);
  console.log(`📧 Contact email endpoint: http://localhost:${PORT}/api/send-contact-email`);
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  WARNING: STRIPE_SECRET_KEY not found in .env file!');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not set – /api/webhook will reject all events.');
  }
  if (!process.env.SMTP_USER && !process.env.WP_EMAIL_USER) {
    console.warn('⚠️  WARNING: SMTP credentials not found in .env file!');
    console.warn('   Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to .env for email functionality');
  }
});
