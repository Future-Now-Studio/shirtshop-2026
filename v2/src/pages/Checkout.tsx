import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/lib/supabase";
import { stripePromise } from "@/lib/stripe";
import { useCart } from "@/stores/cart";
import { fetchDiscountData, computeTotals } from "@/pages/Cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function OrderSummary({ items }: { items: ReturnType<typeof useCart.getState>["items"] }) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data } = useQuery({
    queryKey: ["checkout-discounts", productIds.join(",")],
    queryFn: () => fetchDiscountData(productIds),
  });
  const t = data ? computeTotals(items, data.discounts, data.excluded) : null;
  return (
    <div className="mb-6 space-y-1.5 rounded-xl border bg-muted/30 p-4 text-sm">
      <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span className="tabular-nums">{t?.subtotal.toFixed(2) ?? "…"} €</span></div>
      {t && t.pct > 0 && (
        <div className="flex justify-between text-secondary-foreground"><span>Mengenrabatt ({t.pct}%)</span><span className="tabular-nums">−{t.discount.toFixed(2)} €</span></div>
      )}
      <div className="flex justify-between"><span className="text-muted-foreground">Versand</span><span className="tabular-nums">{t ? (t.shipping === 0 ? "gratis" : `${t.shipping.toFixed(2)} €`) : "…"}</span></div>
      <div className="flex justify-between border-t pt-1.5 font-bold"><span>Gesamt</span><span className="tabular-nums text-primary">{t?.grandTotal.toFixed(2) ?? "…"} €</span></div>
      {t && <p className="text-right text-xs text-muted-foreground">inkl. {t.vat.toFixed(2)} € MwSt (19%)</p>}
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
    const { data, error } = await supabase.functions.invoke("create-payment-intent", {
      body: { items: cartPayload(items) },
    });
    setBusy(false);
    if (error || data?.error) setError(error?.message ?? data.error);
    else setClientSecret(data.clientSecret);
  }

  const set = (k: keyof Customer, v: string) => setCustomer((c) => ({ ...c, [k]: v }));

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 shadow-card">
      <h1 className="mb-6 text-3xl font-extrabold">Kasse</h1>

      <OrderSummary items={items} />

      {!clientSecret ? (
        <form onSubmit={startPayment} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input required value={customer.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-Mail</Label>
            <Input type="email" required value={customer.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input required value={customer.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label>PLZ</Label>
              <Input required value={customer.postalCode} onChange={(e) => set("postalCode", e.target.value)} className="w-28" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Stadt</Label>
              <Input required value={customer.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Weiter…" : "Weiter zur Zahlung"}
          </Button>
        </form>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <PayForm customer={customer} items={items} />
        </Elements>
      )}
    </div>
  );
}

function PayForm({ customer, items }: { customer: Customer; items: ReturnType<typeof useCart.getState>["items"] }) {
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

    if (paymentIntent?.status === "succeeded") {
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          paymentIntentId: paymentIntent.id,
          customer: {
            name: customer.name,
            email: customer.email,
            address: { line1: customer.address, postal_code: customer.postalCode, city: customer.city, country: customer.country },
          },
          items: cartPayload(items),
        },
      });
      setBusy(false);
      if (error || data?.error) { setError(error?.message ?? data.error); return; }
      clear();
      navigate(`/bestellung/${data.orderId}`, {
        state: { total: data.total, itemCount: data.itemCount, email: customer.email },
      });
    } else {
      setBusy(false);
      setError("Zahlung nicht abgeschlossen.");
    }
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!stripe || busy}>
        {busy ? "Zahlung läuft…" : "Jetzt bezahlen"}
      </Button>
    </form>
  );
}
