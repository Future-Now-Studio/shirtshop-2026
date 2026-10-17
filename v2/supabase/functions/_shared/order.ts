// Turns a succeeded PaymentIntent into an order. Used by create-order (browser
// returns after payment) and stripe-webhook (browser closed) — whichever runs
// first creates the order; place_order makes the second call a no-op.
import { cartHash, HttpError, priceLines, type CartLine } from "./cart.ts";
import { sendCustomerOrderEmail, sendOwnerOrderEmail } from "./email.ts";

export async function placeOrderForIntent(supabase: any, intent: any) {
  if (intent.status !== "succeeded") throw new HttpError(402, `Zahlung nicht abgeschlossen (${intent.status}).`);
  if (intent.currency !== "eur") throw new HttpError(400, "Ungültige Währung.");

  // The cart priced in create-payment-intent — never the client's copy.
  const { data: cart, error: cartErr } = await supabase
    .from("checkout_carts").select("items, customer").eq("payment_intent_id", intent.id).maybeSingle();
  if (cartErr) throw cartErr;
  if (!cart) return null;
  const lines = cart.items as CartLine[];
  if (intent.metadata?.cart_hash !== (await cartHash(lines))) {
    throw new Error(`cart hash mismatch for ${intent.id}`);
  }

  // The paid amount is authoritative (computed server-side when the intent was
  // created). Unit prices are re-read from the DB for the order lines; a
  // product unpublished after payment must not block the order.
  const priced = await priceLines(supabase, lines, { requirePublished: false });
  const total = intent.amount / 100;
  const discount = Number(intent.metadata.discount || 0);
  const customer = cart.customer ?? {};

  const { data: placed, error: placeErr } = await supabase.rpc("place_order", {
    p_order: {
      customer_name: customer.name ?? null,
      customer_email: customer.email ?? null,
      customer_address: customer.address ?? null,
      total: total.toFixed(2),
      discount_amount: discount.toFixed(2),
      volume_discount_amount: Number(intent.metadata.volume_discount || 0).toFixed(2),
      // Older intents have no shipping metadata — leave it null then.
      shipping_amount: intent.metadata.shipping ? Number(intent.metadata.shipping).toFixed(2) : null,
      coupon_code: intent.metadata.coupon_code || null,
      stripe_payment_intent_id: intent.id,
    },
    // Design media already lives in the order-designs bucket under designId;
    // we store the id + manifest so the admin can list every file.
    p_items: priced.map(({ line, unit }) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      size_id: line.sizeId,
      qty: line.qty,
      unit_price: unit.toFixed(2),
      design_data: line.designId ? { designId: line.designId, manifest: line.designManifest } : null,
    })),
    p_coupon_id: intent.metadata.coupon_id || null,
  });
  if (placeErr) throw placeErr;

  if (placed.created) {
    const mail = {
      id: placed.order_id,
      customerName: customer.name ?? null,
      customerEmail: customer.email ?? null,
      address: customer.address ?? null,
      lines: priced.map(({ line, unit, name }) => ({ name, qty: line.qty, unit, designElementCount: line.designElementCount })),
      discount,
      total,
    };
    // Emails are best effort — never fail an already-placed order.
    await Promise.allSettled([sendOwnerOrderEmail(supabase, mail), sendCustomerOrderEmail(mail)]);
  }

  return {
    orderId: placed.order_id as string,
    total: total.toFixed(2),
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
  };
}
