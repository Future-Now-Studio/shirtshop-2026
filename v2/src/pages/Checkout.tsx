import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { invokeFn } from "@/lib/functions";
import { stripePromise } from "@/lib/stripe";
import { useCart, unitPrice } from "@/stores/cart";
import { fetchDiscountData, computeTotals, vatIncludedIn, vatLabel, DEFAULT_SHOP_CONFIG } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eur } from "@/lib/utils";

function OrderSummary({ items, coupon }: { items: ReturnType<typeof useCart.getState>["items"]; coupon?: { discount: number; amount: number } | null }) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data } = useQuery({
    queryKey: ["checkout-discounts", productIds.join(",")],
    queryFn: () => fetchDiscountData(productIds),
  });
  const t = data ? computeTotals(items, data.discounts, data.excluded, data.cfg) : null;
  const cfg = data?.cfg ?? DEFAULT_SHOP_CONFIG;
  // Once the payment is prepared, the server-computed amount is authoritative.
  const grand = coupon ? coupon.amount / 100 : t?.grandTotal;
  return (
    <div className="mb-6 space-y-1.5 rounded-xl border bg-muted/30 p-4 text-sm">
      <ul className="mb-3 space-y-1 border-b pb-3">
        {items.map((i) => (
          <li key={i.key} className="flex justify-between gap-3">
            <span>
              {i.qty}× {i.productName}
              <span className="text-muted-foreground">
                {" "}· {i.colorName}{i.sizeName ? ` · ${i.sizeName}` : ""}
                {i.designElementCount > 0 ? ` · ${i.designElementCount} Design-Element(e)` : ""}
              </span>
            </span>
            <span className="tabular-nums">{eur((unitPrice(i) * i.qty))}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span className="tabular-nums">{t ? eur(t.subtotal) : "… €"}</span></div>
      {t && t.pct > 0 && (
        <div className="flex justify-between text-secondary-foreground"><span>Mengenrabatt ({t.pct}%)</span><span className="tabular-nums">−{eur(t.discount)}</span></div>
      )}
      {coupon && coupon.discount > 0 && (
        <div className="flex justify-between text-secondary-foreground"><span>Gutschein</span><span className="tabular-nums">−{eur(coupon.discount)}</span></div>
      )}
      <div className="flex justify-between"><span className="text-muted-foreground">Versand</span><span className="tabular-nums">{t ? (t.shipping === 0 ? "gratis" : `${eur(t.shipping)}`) : "…"}</span></div>
      <div className="flex justify-between border-t pt-1.5 font-bold"><span>Gesamt</span><span className="tabular-nums text-primary">{grand != null ? eur(grand) : "… €"}</span></div>
      {grand != null && <p className="text-right text-xs text-muted-foreground">inkl. {eur(vatIncludedIn(grand, cfg))} MwSt ({vatLabel(cfg)})</p>}
    </div>
  );
}

interface Customer {
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
}

type PaymentResult =
  | { kind: "order"; orderId: string; total: string; itemCount: number }
  | { kind: "processing" }
  | { kind: "error"; message: string };

/**
 * After Stripe confirmed (inline or after a redirect): create the order for a
 * succeeded payment. Slow methods (SEPA) report "processing" — the webhook
 * creates the order once the money arrives.
 */
export async function finishPayment(paymentIntentId?: string, status?: string): Promise<PaymentResult> {
  if (!paymentIntentId) return { kind: "error", message: "Zahlung nicht abgeschlossen." };
  if (status === "processing") return { kind: "processing" };
  if (status !== "succeeded") return { kind: "error", message: "Die Zahlung wurde nicht abgeschlossen. Bitte versuche es erneut." };
  // The order is built server-side from the cart stored with the payment.
  const { data, error } = await invokeFn("create-order", { paymentIntentId });
  if (error) return { kind: "error", message: error };
  return { kind: "order", orderId: data.orderId, total: data.total, itemCount: data.itemCount };
}

function cartPayload(items: ReturnType<typeof useCart.getState>["items"]) {
  return items.map((i) => ({
    productId: i.productId,
    variantId: i.variantId,
    sizeId: i.sizeId,
    qty: i.qty,
    designElementCount: i.designElementCount,
    designId: i.designId,
    designManifest: i.designManifest,
  }));
}

export default function Checkout() {
  const items = useCart((s) => s.items);
  const [customer, setCustomer] = useState<Customer>({
    name: "", email: "", address: "", postalCode: "", city: "", country: "DE",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState<string | null>(null);
  const [serverCoupon, setServerCoupon] = useState<{ discount: number; amount: number } | null>(null);

  if (items.length === 0)
    return (
      <div className="py-16 text-center text-muted-foreground">
        Warenkorb leer. <Link to="/" className="underline">Weiter einkaufen</Link>
      </div>
    );

  if (!stripePromise)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-destructive">Stripe ist noch nicht konfiguriert.</p>
        <p className="mt-2 text-sm text-muted-foreground">VITE_STRIPE_PUBLISHABLE_KEY in v2/.env setzen.</p>
      </div>
    );

  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await invokeFn("create-payment-intent", {
      items: cartPayload(items),
      couponCode: coupon.trim() || undefined,
      customer: {
        name: customer.name,
        email: customer.email,
        address: { line1: customer.address, postal_code: customer.postalCode, city: customer.city, country: customer.country },
      },
    });
    setBusy(false);
    if (error) setError(error);
    else {
      if (coupon.trim()) setCouponInfo(data.discount > 0 ? `Gutschein angewendet: −${eur(Number(data.discount))}` : (data.couponReason ?? "Gutschein ungültig"));
      setServerCoupon({ discount: Number(data.discount ?? 0), amount: Number(data.amount) });
      setClientSecret(data.clientSecret);
    }
  }

  const set = (k: keyof Customer, v: string) => setCustomer((c) => ({ ...c, [k]: v }));

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 shadow-card">
      <h1 className="mb-6 text-3xl font-extrabold">Kasse</h1>

      <OrderSummary items={items} coupon={serverCoupon} />

      {!clientSecret ? (
        <form onSubmit={startPayment} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="co-name">Name</Label>
            <Input required id="co-name" autoComplete="name" value={customer.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-email">E-Mail</Label>
            <Input type="email" required id="co-email" autoComplete="email" value={customer.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-address">Adresse</Label>
            <Input required id="co-address" autoComplete="street-address" value={customer.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-postalCode">PLZ</Label>
              <Input required id="co-postalCode" autoComplete="postal-code" value={customer.postalCode} onChange={(e) => set("postalCode", e.target.value)} className="w-28" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="co-city">Stadt</Label>
              <Input required id="co-city" autoComplete="address-level2" value={customer.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-coupon">Gutscheincode (optional)</Label>
            <Input id="co-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="z. B. SOMMER10" />
            {couponInfo && <p className="text-xs text-muted-foreground">{couponInfo}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Weiter…" : "Weiter zur Zahlung"}
          </Button>
        </form>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <PayForm customer={customer} />
        </Elements>
      )}
    </div>
  );
}

function PayForm({ customer }: { customer: Customer }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const clear = useCart((s) => s.clear);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message ?? "Fehler"); setBusy(false); return; }

    const { error: payErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        // Payment methods with a bank/app redirect (Klarna, giropay, …) come
        // back here; cards and wallets finish inline below.
        return_url: `${window.location.origin}/kasse/abschluss`,
        payment_method_data: {
          billing_details: {
            name: customer.name,
            email: customer.email,
            address: { line1: customer.address, postal_code: customer.postalCode, city: customer.city, country: customer.country },
          },
        },
      },
    });

    if (payErr) { setError(payErr.message ?? "Zahlung fehlgeschlagen"); setBusy(false); return; }

    const result = await finishPayment(paymentIntent?.id, paymentIntent?.status);
    setBusy(false);
    if (result.kind === "error") { setError(result.message); return; }
    clear();
    navigate(result.kind === "order" ? `/bestellung/${result.orderId}` : "/kasse/abschluss?verarbeitung=1", {
      state: result.kind === "order" ? { total: result.total, itemCount: result.itemCount, email: customer.email } : undefined,
    });
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!stripe || busy}>
        {busy ? "Zahlung läuft…" : "Zahlungspflichtig bestellen"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Mit deiner Bestellung gelten unsere <Link to="/agb" className="underline">AGB</Link>. Hinweise zum
        Widerrufsrecht findest du in der <Link to="/widerruf" className="underline">Widerrufsbelehrung</Link> —
        für nach deinen Vorgaben bedruckte Artikel besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 1 BGB).
        Infos zum Datenschutz: <Link to="/datenschutz" className="underline">Datenschutzerklärung</Link>.
      </p>
    </form>
  );
}
