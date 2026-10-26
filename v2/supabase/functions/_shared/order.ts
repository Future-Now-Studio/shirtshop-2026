// Turns a succeeded PaymentIntent into an order. Used by create-order (browser
// returns after payment) and stripe-webhook (browser closed) — whichever runs
// first creates the order; the other one finds it (place_order is idempotent).
import { cartHash, HttpError, priceLines, type CartLine, type PricedLine } from "./cart.ts";
import { sendCustomerOrderEmail, sendOwnerAlert, sendOwnerOrderEmail, type OrderMail } from "./email.ts";

export interface PlacedOrder {
  orderId: string;
  orderNumber: string | null;
  total: string;
  itemCount: number;
}

async function existingOrder(supabase: any, intentId: string): Promise<PlacedOrder | null> {
  const { data, error } = await supabase
    .from("orders").select("id, order_number, total, order_items(qty)")
    .eq("stripe_payment_intent_id", intentId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    orderId: data.id,
    orderNumber: data.order_number ?? null,
    total: Number(data.total).toFixed(2),
    itemCount: (data.order_items ?? []).reduce((s: number, i: any) => s + i.qty, 0),
  };
}

/** Unit prices frozen when the intent was created; older carts are re-priced. */
async function cartPrices(supabase: any, lines: CartLine[], prices: unknown): Promise<PricedLine[]> {
  if (Array.isArray(prices) && prices.length === lines.length && prices.every((p: any) => Number.isFinite(Number(p?.unit)))) {
    return lines.map((line, i) => ({ line, unit: Number(prices[i].unit), name: String(prices[i].name ?? "Artikel"), excluded: false }));
  }
  return priceLines(supabase, lines, { requirePublished: false });
}

export async function placeOrderForIntent(supabase: any, intent: any): Promise<PlacedOrder | null> {
  if (intent.status !== "succeeded") throw new HttpError(402, `Zahlung nicht abgeschlossen (${intent.status}).`);
  if (intent.currency !== "eur") throw new HttpError(400, "Ungültige Währung.");

  const existing = await existingOrder(supabase, intent.id);
  if (existing) return existing;

  // The cart priced in create-payment-intent — never the client's copy.
  const { data: cart, error: cartErr } = await supabase
    .from("checkout_carts").select("items, prices, customer").eq("payment_intent_id", intent.id).maybeSingle();
  if (cartErr) throw cartErr;
  // No cart: either the other caller just placed the order (and dropped the
  // cart) or the payment has no cart at all (null → owner alert).
  if (!cart) return existingOrder(supabase, intent.id);
  const lines = cart.items as CartLine[];
  if (intent.metadata?.cart_hash !== (await cartHash(lines))) {
    throw new Error(`cart hash mismatch for ${intent.id}`);
  }

  // The paid amount and its parts are authoritative (computed server-side
  // when the intent was created, in cents, so they add up).
  const priced = await cartPrices(supabase, lines, cart.prices);
  const meta = intent.metadata ?? {};
  const total = intent.amount / 100;
  const discount = Number(meta.discount || 0);
  const volumeDiscount = Number(meta.volume_discount || 0);
  // Older intents have no shipping metadata — leave it null then.
  const shipping = meta.shipping ? Number(meta.shipping) : null;
  const customer = cart.customer ?? {};

  const { data: placed, error: placeErr } = await supabase.rpc("place_order", {
    p_order: {
      customer_name: customer.name ?? null,
      customer_email: customer.email ?? null,
      customer_address: customer.address ?? null,
      total: total.toFixed(2),
      discount_amount: discount.toFixed(2),
      volume_discount_amount: volumeDiscount.toFixed(2),
      shipping_amount: shipping != null ? shipping.toFixed(2) : null,
      coupon_code: meta.coupon_code || null,
      stripe_payment_intent_id: intent.id,
    },
    // Design media already lives in the order-designs bucket under designId;
    // we store the id, the manifest and the paid (server-verified) element
    // count so the admin can list every file and compare.
    p_items: priced.map(({ line, unit, name }) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      size_id: line.sizeId,
      qty: line.qty,
      unit_price: unit.toFixed(2),
      product_name: name,
      design_data: line.designId
        ? { designId: line.designId, manifest: line.designManifest, elementCount: line.designElementCount }
        : null,
    })),
    p_coupon_id: meta.coupon_id || null,
  });
  if (placeErr) throw placeErr;

  if (placed.created) {
    const mail: OrderMail = {
      id: placed.order_id,
      orderNumber: placed.order_number ?? null,
      customerName: customer.name ?? null,
      customerEmail: customer.email ?? null,
      address: customer.address ?? null,
      lines: priced.map(({ line, unit, name }) => ({ name, qty: line.qty, unit, designElementCount: line.designElementCount })),
      subtotal: priced.reduce((s, { line, unit }) => s + Math.round(unit * 100) * line.qty, 0) / 100,
      volumeDiscount,
      discount,
      couponCode: meta.coupon_code || null,
      shipping,
      total,
      reviewReason: placed.review_reason ?? null,
    };
    // Emails are best effort — never fail an already-placed order. The result
    // of the customer confirmation is recorded for the admin.
    const customerMailSent = await sendCustomerOrderEmail(supabase, mail).catch(() => false);
    const { error: flagErr } = await supabase.from("orders").update({ email_sent: customerMailSent }).eq("id", placed.order_id);
    if (flagErr) console.error("email_sent update failed:", flagErr);
    await sendOwnerOrderEmail(supabase, mail, customerMailSent).catch((e) => console.error(e));
  }

  return {
    orderId: placed.order_id as string,
    orderNumber: placed.order_number ?? null,
    total: total.toFixed(2),
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
  };
}

/**
 * Tells the shop owner — once per payment — that a succeeded payment could not
 * be turned into an order (e.g. catalogue or DB problem). Never throws.
 */
export async function alertOrderFailure(supabase: any, intent: any, err: unknown) {
  if (intent?.status !== "succeeded") return;
  try {
    const { data } = await supabase
      .from("checkout_carts").update({ failure_alerted_at: new Date().toISOString() })
      .eq("payment_intent_id", intent.id).is("failure_alerted_at", null).select("payment_intent_id");
    if (!data?.length) return; // no cart (separate alert) or already alerted
    const reason = (err as any)?.message ?? String(err);
    await sendOwnerAlert(
      supabase,
      "⚠️ Bezahlte Bestellung konnte nicht angelegt werden",
      `Eine Stripe-Zahlung war erfolgreich, aber die Bestellung konnte nicht angelegt werden.
PaymentIntent: ${intent.id}, Betrag: ${(intent.amount / 100).toFixed(2)} ${String(intent.currency).toUpperCase()}.
Fehler: ${reason}
Stripe wiederholt den Webhook automatisch. Bitte im Admin prüfen, ob die Bestellung erscheint – sonst den Kunden kontaktieren und die Zahlung erstatten oder die Bestellung manuell erfassen.`,
    );
  } catch (e) {
    console.error("order failure alert failed:", e);
  }
}
