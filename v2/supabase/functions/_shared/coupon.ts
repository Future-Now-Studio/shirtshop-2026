// Server-side coupon validation for create-payment-intent. Returns the
// discount in cents to apply to the goods total (after volume discount,
// before shipping). Never trusts client-sent discounts. Uses held by open
// checkout attempts count against max_uses (coupon_open_reservations); the
// use itself is reserved atomically in save_checkout_cart and re-checked in
// place_order.
export async function validateCoupon(supabase: any, code: string | null | undefined, goodsCents: number) {
  if (!code || !String(code).trim()) return { discount: 0, coupon: null as any, reason: null as string | null };
  const { data: c, error } = await supabase.from("coupons").select("*").eq("code", String(code).trim().toUpperCase()).maybeSingle();
  if (error) throw error;
  const now = Date.now();
  // Unknown, inactive and not-yet-valid codes look the same (no guessing oracle).
  if (!c || !c.active || (c.valid_from && new Date(c.valid_from).getTime() > now)) {
    return { discount: 0, coupon: null, reason: "Code ungültig" };
  }
  if (c.valid_until && new Date(c.valid_until).getTime() < now) return { discount: 0, coupon: null, reason: "Abgelaufen" };
  if (c.max_uses != null) {
    const { data: open, error: rErr } = await supabase.rpc("coupon_open_reservations", { p_coupon_id: c.id });
    if (rErr) throw rErr;
    if (c.used_count + Number(open ?? 0) >= c.max_uses) return { discount: 0, coupon: null, reason: "Limit erreicht" };
  }
  const minOrder = Number(c.min_order ?? 0);
  if (goodsCents < Math.round(minOrder * 100)) {
    return { discount: 0, coupon: null, reason: `Mindestbestellwert ${minOrder.toFixed(2).replace(".", ",")} €` };
  }
  const raw = c.kind === "percent" ? Math.round((goodsCents * Number(c.value)) / 100) : Math.round(Number(c.value) * 100);
  const discount = Math.min(Math.max(0, raw), goodsCents);
  return { discount, coupon: c, reason: null };
}
