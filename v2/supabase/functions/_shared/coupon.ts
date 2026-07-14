// Server-side coupon validation, shared by create-payment-intent + create-order.
// Returns the euro discount to apply to the goods total (after volume discount,
// before shipping). Never trusts client-sent discounts.
export async function validateCoupon(supabase: any, code: string | null | undefined, goodsTotal: number) {
  if (!code) return { discount: 0, coupon: null as any, reason: null as string | null };
  const { data: c } = await supabase.from("coupons").select("*").eq("code", String(code).trim().toUpperCase()).maybeSingle();
  if (!c) return { discount: 0, coupon: null, reason: "Code ungültig" };
  const now = Date.now();
  if (!c.active) return { discount: 0, coupon: null, reason: "Code inaktiv" };
  if (c.valid_from && new Date(c.valid_from).getTime() > now) return { discount: 0, coupon: null, reason: "Noch nicht gültig" };
  if (c.valid_until && new Date(c.valid_until).getTime() < now) return { discount: 0, coupon: null, reason: "Abgelaufen" };
  if (c.max_uses != null && c.used_count >= c.max_uses) return { discount: 0, coupon: null, reason: "Limit erreicht" };
  if (goodsTotal < Number(c.min_order ?? 0)) return { discount: 0, coupon: null, reason: `Mindestbestellwert ${Number(c.min_order).toFixed(2)} €` };
  const raw = c.kind === "percent" ? (goodsTotal * Number(c.value)) / 100 : Number(c.value);
  const discount = Math.min(Math.max(0, raw), goodsTotal);
  return { discount, coupon: c, reason: null };
}
