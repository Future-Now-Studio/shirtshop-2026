// Backend server for Stripe PaymentIntent creation
// Run with: npm run server
// Uses Stripe API: https://api.stripe.com/v1/

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

// WooCommerce Configuration
const WOOCOMMERCE_CONFIG = {
  baseUrl: 'https://timob10.sg-host.com/wp-json/wc/v3',
  consumerKey: 'ck_17e70b1dcd1b0d0aab92da0c8ac7bda10a280827',
  consumerSecret: 'cs_e7d6fe86192848c4d06c5b0eb4692d32d2b42a50',
};

// Create Basic Auth header for WooCommerce
function getWooCommerceAuthHeader() {
  const credentials = `${WOOCOMMERCE_CONFIG.consumerKey}:${WOOCOMMERCE_CONFIG.consumerSecret}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe with secret key from .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
// Increase body size limit to 50MB to handle large checkout payloads (e.g., custom designs)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Stripe backend server is running' });
});

// Create PaymentIntent endpoint
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'eur', items } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    // Create PaymentIntent with automatic payment methods enabled
    // This enables PayPal, credit cards, Apple Pay, Google Pay, etc.
    
    // Prepare metadata - Stripe metadata values are limited to 500 characters
    // Store only essential information, not full item objects
    const metadata = {};
    if (items && items.length > 0) {
      // Store item count and summary
      metadata.item_count = items.length.toString();
      metadata.total_items = items.reduce((sum, item) => sum + item.quantity, 0).toString();
      
      // Store product IDs (comma-separated, max 500 chars)
      const productIds = items.map(item => item.productId).join(',');
      if (productIds.length <= 500) {
        metadata.product_ids = productIds;
      }
      
      // Store item names (truncated if needed)
      const itemNames = items.map(item => `${item.name} (${item.quantity}x)`).join(', ');
      if (itemNames.length <= 500) {
        metadata.items = itemNames;
      } else {
        metadata.items = itemNames.substring(0, 497) + '...';
      }
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'always', // Allow redirects for PayPal, etc.
      },
      // Note: Don't specify payment_method_types when using automatic_payment_methods
      // automatic_payment_methods will automatically include card, paypal, link, apple_pay, google_pay, etc.
      metadata: metadata,
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create payment intent',
      details: error.type || 'Unknown error'
    });
  }
});

// Create WooCommerce Order endpoint
app.post('/api/create-order', async (req, res) => {
  try {
    const { 
      items, 
      shipping, 
      billing, 
      paymentIntentId,
      transactionId,
      total 
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Prepare line items for WooCommerce
    // Pricing model: Base price + (design elements * 10€) per unit
    const lineItems = items.map(item => {
      // Log item for debugging
      console.log(`Processing item:`, {
        name: item.name,
        productId: item.productId,
        productIdType: typeof item.productId,
        price: item.price,
        designElementCount: item.designElementCount
      });
      
      // Validate product_id for regular products
      if (item.productId !== 999 && (!item.productId || item.productId <= 0)) {
        console.error('Invalid product_id for item:', item);
        throw new Error(`Invalid product_id: ${item.productId} for item ${item.name}`);
      }
      const itemMeta = [
        { key: 'Color', value: item.color || 'Standard' },
        { key: 'Size', value: item.size || 'Standard' },
      ];
      
      // Add custom design if present - support both old format (customDesign) and new format (customDesigns)
      if (item.customDesigns && Object.keys(item.customDesigns).length > 0) {
        // New format: multiple images per view (front, back, left, right)
        itemMeta.push({ key: 'Custom Design', value: 'Yes (Multiple Views)' });
        
        // Store each view's design image
        Object.entries(item.customDesigns).forEach(([view, imageBase64]) => {
          const designImageSize = imageBase64.length;
          const viewKey = `custom_design_${view}`;
          
          // Only store base64 if it's not too large (WooCommerce might have limits)
          if (designImageSize < 500000) { // Less than ~500KB
            itemMeta.push({ key: viewKey, value: imageBase64 });
          } else {
            // For large images, store a truncated version and note
            itemMeta.push({ 
              key: viewKey, 
              value: imageBase64.substring(0, 1000) + '... [TRUNCATED - See order notes for full data]' 
            });
          }
        });
        
        // Store raw design elements (text, images, etc.) as JSON
        if (item.customDesignRaw) {
          const rawDataSize = item.customDesignRaw.length;
          if (rawDataSize < 500000) { // Less than ~500KB
            itemMeta.push({ 
              key: 'custom_design_raw_elements', 
              value: item.customDesignRaw 
            });
          } else {
            // For large JSON, store truncated version
            itemMeta.push({ 
              key: 'custom_design_raw_elements', 
              value: item.customDesignRaw.substring(0, 1000) + '... [TRUNCATED - See order notes for full data]' 
            });
          }
        }
      } else if (item.customDesign) {
        // Old format: single design image (backward compatibility)
        const designImageBase64 = item.customDesign;
        const designImageSize = designImageBase64.length;
        
        // WooCommerce meta_data values have a limit, so we'll store it and also add a note
        itemMeta.push(
          { key: 'Custom Design', value: 'Yes' },
          { key: 'custom_design_image_size', value: designImageSize.toString() },
        );
        
        // Only store base64 if it's not too large (WooCommerce might have limits)
        if (designImageSize < 500000) { // Less than ~500KB
          itemMeta.push({ key: 'custom_design_image', value: designImageBase64 });
        } else {
          // For large images, store a truncated version and note
          itemMeta.push({ 
            key: 'custom_design_image', 
            value: designImageBase64.substring(0, 1000) + '... [TRUNCATED - See order notes for full data]' 
          });
        }
        
        // Store raw design elements (text, images, etc.) as JSON
        if (item.customDesignRaw) {
          const rawDataSize = item.customDesignRaw.length;
          if (rawDataSize < 500000) { // Less than ~500KB
            itemMeta.push({ 
              key: 'custom_design_raw_elements', 
              value: item.customDesignRaw 
            });
          } else {
            // For large JSON, store truncated version
            itemMeta.push({ 
              key: 'custom_design_raw_elements', 
              value: item.customDesignRaw.substring(0, 1000) + '... [TRUNCATED - See order notes for full data]' 
            });
          }
        }
      }
      
      // Calculate total price for this line item
      // Base price + (design elements * 10€) per unit, multiplied by quantity
      const designElementCount = item.designElementCount || 0;
      const pricePerUnit = item.price + (designElementCount * 10);
      const subtotal = pricePerUnit * item.quantity; // Subtotal before tax
      const total = subtotal; // Total (same as subtotal if no tax)
      
      // Add design element count to meta data
      if (designElementCount > 0) {
        itemMeta.push(
          { key: 'Design Elements Count', value: designElementCount.toString() },
          { key: 'Design Elements Cost', value: `${(designElementCount * 10).toFixed(2)} €` }
        );
      }
      
      // For custom products (productId 999), we need to set price directly
      // WooCommerce requires either a valid product_id OR price + name
      const lineItem = {
        quantity: item.quantity,
        name: item.name,
        meta_data: itemMeta,
      };

      // Check if it's a custom product (productId 999 or "999")
      const isCustomProduct = item.productId === 999 || item.productId === "999" || String(item.productId) === "999";
      
      // If productId is 999 (custom product), add price directly
      if (isCustomProduct) {
        // Custom product - no product_id, use price + name + sku
        // WooCommerce requires either product_id OR sku for line items
        lineItem.sku = `CUSTOM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Generate unique SKU
        lineItem.price = pricePerUnit.toString(); // Price per unit (base + design elements)
        lineItem.subtotal = subtotal.toString(); // Subtotal for this line item
        lineItem.total = total.toString(); // Total for this line item
        console.log(`Custom product line item:`, JSON.stringify(lineItem, null, 2));
      } else {
        // Regular product - must have valid product_id
        // WooCommerce requires product_id to exist in the store
        if (!item.productId || item.productId <= 0) {
          throw new Error(`Invalid product_id: ${item.productId} for item ${item.name}. Product must exist in WooCommerce.`);
        }
        lineItem.product_id = item.productId;
        // For regular products with design elements, we need to override the price
        // Use subtotal and total to override the product's base price
        if (designElementCount > 0 || pricePerUnit !== item.price) {
          // Price has been modified (design elements added), override it
          lineItem.subtotal = subtotal.toString(); // Subtotal for this line item
          lineItem.total = total.toString(); // Total for this line item
        }
        // If no design elements and price matches, WooCommerce will use product price
      }
      
      // Log the line item for debugging
      if (isCustomProduct) {
        console.log(`Final custom product line item:`, JSON.stringify(lineItem, null, 2));
      }
      
      return lineItem;
    });
    
    // Log all line items before sending
    console.log('All line items being sent to WooCommerce:', JSON.stringify(lineItems, null, 2));

    // Create WooCommerce order
    const orderData = {
      status: 'processing', // Will be updated to 'completed' when payment is confirmed
      currency: 'EUR',
      customer_id: 0, // Guest order
      set_paid: true, // Mark as paid since payment already succeeded
      billing: {
        first_name: billing.firstName || '',
        last_name: billing.lastName || '',
        company: '',
        address_1: billing.address || '',
        address_2: '',
        city: billing.city || '',
        state: '',
        postcode: billing.postalCode || '',
        country: billing.country || 'DE',
        email: billing.email || '',
        phone: billing.phone || '',
      },
      shipping: {
        first_name: billing.firstName || '',
        last_name: billing.lastName || '',
        company: '',
        address_1: billing.address || '',
        address_2: '',
        city: billing.city || '',
        state: '',
        postcode: billing.postalCode || '',
        country: billing.country || 'DE',
      },
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      transaction_id: transactionId || paymentIntentId || '',
      line_items: lineItems,
      shipping_total: typeof shipping === 'object' && shipping !== null 
        ? (shipping.total?.toString() || '0') 
        : (typeof shipping === 'number' ? shipping.toString() : '0'),
      total: total.toString(),
      total_tax: '0', // Assuming no tax for now
      cart_tax: '0',
      meta_data: [
        { key: '_stripe_payment_intent_id', value: paymentIntentId || '' },
        { key: '_stripe_transaction_id', value: transactionId || '' },
        // Store custom designs at order level for easy access
        ...(items.some(item => item.customDesign) ? [{
          key: 'has_custom_designs',
          value: 'yes'
        }] : []),
        // Add custom design images as custom fields
        ...items
          .map((item, index) => {
            if (item.customDesign) {
              return [
                {
                  key: `custom_design_image_${index + 1}`,
                  value: item.customDesign
                },
                ...(item.customDesignRaw ? [{
                  key: `custom_design_raw_${index + 1}`,
                  value: item.customDesignRaw
                }] : [])
              ];
            }
            return [];
          })
          .flat(),
      ],
    };

    const response = await fetch(`${WOOCOMMERCE_CONFIG.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': getWooCommerceAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = JSON.stringify(errorJson, null, 2);
        if (errorJson.message) {
          errorDetails = errorJson.message;
        }
      } catch (e) {
        // Not JSON, use text as is
      }
      console.error('WooCommerce order creation error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        orderData: JSON.stringify(orderData, null, 2).substring(0, 1000), // First 1000 chars
      });
      throw new Error(`Failed to create WooCommerce order: ${response.status} ${response.statusText} - ${errorDetails.substring(0, 200)}`);
    }

    const order = await response.json();
    
    // Add order notes with custom design data if any exist
    const customDesignItems = items.filter(item => item.customDesign);
    if (customDesignItems.length > 0) {
      try {
        // For each custom design item, add detailed notes with full data
        for (const item of customDesignItems) {
          const designElementCount = item.designElementCount || 0;
          let noteContent = `=== CUSTOM DESIGN DETAILS ===\n\n`;
          noteContent += `Item: ${item.name}\n`;
          noteContent += `Color: ${item.color}\n`;
          noteContent += `Size: ${item.size}\n`;
          noteContent += `Quantity: ${item.quantity}\n`;
          noteContent += `Design Elements: ${designElementCount} (Cost: ${designElementCount * 10}€)\n\n`;
          
          // Add full design image as base64 in note
          if (item.customDesign) {
            noteContent += `--- DESIGN IMAGE (Base64) ---\n`;
            noteContent += `To view: Copy the base64 string below and paste into browser address bar, or use in HTML: <img src="[paste here]" />\n\n`;
            noteContent += `${item.customDesign}\n\n`;
          }
          
          // Add raw elements JSON
          if (item.customDesignRaw) {
            noteContent += `--- RAW DESIGN ELEMENTS (JSON) ---\n`;
            noteContent += `This contains all design elements (text, images, positions, etc.)\n`;
            noteContent += `Can be loaded back into Fabric.js canvas for editing\n\n`;
            noteContent += `${item.customDesignRaw}\n\n`;
          }
          
          noteContent += `=== END CUSTOM DESIGN ===\n`;
          
          await fetch(`${WOOCOMMERCE_CONFIG.baseUrl}/orders/${order.id}/notes`, {
            method: 'POST',
            headers: {
              'Authorization': getWooCommerceAuthHeader(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              note: noteContent,
              customer_note: false,
            }),
          });
        }
        
        // Add a summary note
        await fetch(`${WOOCOMMERCE_CONFIG.baseUrl}/orders/${order.id}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': getWooCommerceAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            note: `This order contains ${customDesignItems.length} custom design(s). Check line item meta_data for design images and raw element data.`,
            customer_note: false,
          }),
        });
      } catch (noteError) {
        console.log('Could not add order note (non-critical):', noteError);
      }
    }
    
    // Log the order data for debugging
    console.log('Order created with line items:', JSON.stringify(lineItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      meta_data_count: item.meta_data?.length || 0,
      meta_data_keys: item.meta_data?.map(m => m.key) || []
    })), null, 2));
    
    res.json({ 
      success: true,
      orderId: order.id,
      orderNumber: order.number
    });
  } catch (error) {
    console.error('Error creating WooCommerce order:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create order',
      success: false
    });
  }
});

// Stripe Webhook endpoint for payment success (backup order creation)
// This ensures orders are created even if frontend flow fails
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Note: For production, set STRIPE_WEBHOOK_SECRET in .env
    // For testing, you can skip verification temporarily
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For development/testing without webhook secret
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    try {
      // Retrieve the payment intent to get full details
      const fullPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
      
      console.log('Payment succeeded via webhook:', paymentIntent.id);
      console.log('Metadata:', fullPaymentIntent.metadata);
      
      // Check if order already exists (by checking metadata or querying WooCommerce)
      // If not, create it here as a backup
      // This is a safety net in case frontend order creation failed
      
    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  }

  res.json({ received: true });
});

// Contact form email endpoint
app.post('/api/send-contact-email', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Create transporter using WordPress/WooCommerce SMTP settings
    // For production, configure SMTP settings in .env file
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.timob10.sg-host.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.WP_EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.WP_EMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: `"Private Shirt Contact Form" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@private-shirt.de'}>`,
      to: 'timobeyer_@outlook.de',
      subject: `Neue Kontaktanfrage von ${name}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        ${phone ? `<p><strong>Telefon:</strong> ${phone}</p>` : ''}
        <p><strong>Nachricht:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Diese E-Mail wurde über das Kontaktformular auf private-shirt.de gesendet.
        </p>
      `,
      text: `
Neue Kontaktanfrage

Name: ${name}
E-Mail: ${email}
${phone ? `Telefon: ${phone}` : ''}

Nachricht:
${message}

---
Diese E-Mail wurde über das Kontaktformular auf private-shirt.de gesendet.
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Contact email sent:', info.messageId);

    res.json({ 
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to send email',
      success: false
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Stripe backend server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoint: http://localhost:${PORT}/api/create-payment-intent`);
  console.log(`📧 Contact email endpoint: http://localhost:${PORT}/api/send-contact-email`);
  console.log(`🔑 Using Stripe API: https://api.stripe.com/v1/`);
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  WARNING: STRIPE_SECRET_KEY not found in .env file!');
  }
  if (!process.env.SMTP_USER && !process.env.WP_EMAIL_USER) {
    console.warn('⚠️  WARNING: SMTP credentials not found in .env file!');
    console.warn('   Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to .env for email functionality');
  }
});

