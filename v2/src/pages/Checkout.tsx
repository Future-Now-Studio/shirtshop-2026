import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { invokeFn } from "@/lib/functions";
import { stripePromise } from "@/lib/stripe";
import { useCart, unitPrice } from "@/stores/cart";
import { fetchDiscountData, computeTotals, vatIncludedIn, vatLabel, DEFAULT_SHOP_CONFIG } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeliveryTime } from "@/components/DeliveryTime";
import { eur } from "@/lib/utils";

/** Amounts of the prepared payment as computed by create-payment-intent. */
interface ServerTotals {
  amount: number; // cents, charged
  subtotal: number;
  volumeDiscount: number;
  discount: number;
  shipping: number;
  couponCode: string | null;
}

function OrderSummary({ items, server }: { items: ReturnType<typeof useCart.getState>["items"]; server?: ServerTotals | null }) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const syncPrices = useCart((s) => s.syncPrices);
  const { data, isError, refetch } = useQuery({
    queryKey: ["checkout-discounts", productIds.join(",")],
    queryFn: () => fetchDiscountData(productIds),
  });
  // Lines carry the price from when they were added; show current prices.
  const [pricesChanged, setPricesChanged] = useState(false);
  useEffect(() => {
    if (data && syncPrices(data.prices)) setPricesChanged(true);
  }, [data, syncPrices]);
  const t = data ? computeTotals(items, data.discounts, data.excluded, data.cfg) : null;
  const cfg = data?.cfg ?? DEFAULT_SHOP_CONFIG;
  // Once the payment is prepared, the server-computed amounts are authoritative.
  const subtotal = server ? server.subtotal : t?.subtotal;
  const volumeDiscount = server ? server.volumeDiscount : t?.discount;
  const shipping = server ? server.shipping : t?.shipping;
  const grand = server ? server.amount / 100 : t?.grandTotal;
  const drift = !!server && !!t && Math.abs(server.subtotal - t.subtotal) >= 0.005;
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
      {(pricesChanged || drift) && (
        <p role="status" className="pb-1 text-xs text-amber-800">
          Die Preise einiger Artikel haben sich geändert. Maßgeblich ist der hier angezeigte Gesamtbetrag.
        </p>
      )}
      {isError && !server && (
        <p role="alert" className="pb-1 text-xs text-destructive">
          Die Preise konnten nicht geladen werden.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>Erneut versuchen</button>
        </p>
      )}
      <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span className="tabular-nums">{subtotal != null ? eur(subtotal) : "… €"}</span></div>
      {volumeDiscount != null && volumeDiscount > 0 && (
        <div className="flex justify-between text-secondary-foreground"><span>Mengenrabatt{t?.pct ? ` (${t.pct}%)` : ""}</span><span className="tabular-nums">−{eur(volumeDiscount)}</span></div>
      )}
      {server && server.discount > 0 && (
        <div className="flex justify-between text-secondary-foreground"><span>Gutschein{server.couponCode ? ` ${server.couponCode}` : ""}</span><span className="tabular-nums">−{eur(server.discount)}</span></div>
      )}
      <div className="flex justify-between"><span className="text-muted-foreground">Versand</span><span className="tabular-nums">{shipping != null ? (shipping === 0 ? "gratis" : `${eur(shipping)}`) : "…"}</span></div>
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
  | { kind: "order"; orderId: string; orderNumber: string | null; total: string; itemCount: number }
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
  return { kind: "order", orderId: data.orderId, orderNumber: data.orderNumber ?? null, total: data.total, itemCount: data.itemCount };
}

/**
 * Shown when the payment went through but the order could not be created yet.
 * The customer must never be invited to pay again: this only retries the
 * order creation (the stripe-webhook creates it in any case).
 */
export function PaymentReceived({ paymentIntentId, email }: { paymentIntentId: string; email?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function retry() {
    setBusy(true);
    setFailed(false);
    const result = await finishPayment(paymentIntentId, "succeeded");
    setBusy(false);
    if (result.kind === "order") {
      navigate(`/bestellung/${result.orderId}`, {
        replace: true,
        state: { total: result.total, itemCount: result.itemCount, email, orderNumber: result.orderNumber },
      });
    } else {
      if (result.kind === "error") console.error("create-order:", result.message);
      setFailed(true);
    }
  }

  // One automatic retry after a few seconds (cold starts, short outages).
  useEffect(() => {
    const t = setTimeout(retry, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
      <h1 className="mt-4 text-2xl font-bold">Zahlung eingegangen – Bestellung wird verarbeitet</h1>
      <p className="mt-2 text-muted-foreground">
        Deine Zahlung ist bei uns angekommen – du musst nicht noch einmal bezahlen. Wir legen deine Bestellung
        gerade an. Die Bestellbestätigung schicken wir dir per E-Mail{email ? ` an ${email}` : ""}.
      </p>
      {failed && (
        <p role="alert" className="mt-4 text-sm text-muted-foreground">
          Das Anlegen dauert gerade länger. Keine Sorge: Deine Bestellung wird automatisch angelegt. Du kannst es
          hier noch einmal versuchen oder die Seite einfach schließen.
        </p>
      )}
      <Button className="mt-6" variant="outline" onClick={retry} disabled={busy}>
        {busy ? "Bestellung wird angelegt…" : "Bestellstatus erneut prüfen"}
      </Button>
      <p className="mt-6 text-xs text-muted-foreground">
        Zahlungsreferenz für Rückfragen: <span className="font-mono">{paymentIntentId}</span>
        <br />
        Fragen? <a href="mailto:info@private-shirt.de" className="underline">info@private-shirt.de</a>
      </p>
    </div>
  );
}

// The client secret of the latest unpaid checkout attempt, so that a new
// attempt (after "Angaben ändern" or a reload) can release the old one and its
// coupon reservation. Per-browser convenience only; kept in memory too, so
// "Angaben ändern" also works when storage is blocked.
const ATTEMPT_KEY = "shirtshop-v2-checkout-attempt";
let attemptInMemory: string | null = null;
const lastAttempt = () => { try { return localStorage.getItem(ATTEMPT_KEY) ?? attemptInMemory; } catch { return attemptInMemory; } };
const rememberAttempt = (secret: string) => {
  attemptInMemory = secret;
  try { localStorage.setItem(ATTEMPT_KEY, secret); } catch { /* storage blocked */ }
};
export const forgetAttempt = () => {
  attemptInMemory = null;
  try { localStorage.removeItem(ATTEMPT_KEY); } catch { /* storage blocked */ }
};

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
  const clear = useCart((s) => s.clear);
  const [customer, setCustomer] = useState<Customer>({
    name: "", email: "", address: "", postalCode: "", city: "", country: "DE",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const [server, setServer] = useState<ServerTotals | null>(null);
  const [paidIntent, setPaidIntent] = useState<string | null>(null);
  const [paying, setPaying] = useState(false); // no "Angaben ändern" while a payment runs
  const navigate = useNavigate();

  // The last attempt may have been paid elsewhere (redirect into another
  // browser/app, tab closed during create-order). Then the cart is already
  // bought: hand over to the return page, which finishes the order and
  // clears the cart, instead of offering to pay again.
  useEffect(() => {
    const secret = lastAttempt();
    if (!secret || !stripePromise) return;
    let cancelled = false;
    (async () => {
      try {
        const stripe = await stripePromise;
        const { paymentIntent } = (await stripe!.retrievePaymentIntent(secret)) ?? {};
        if (cancelled || !paymentIntent) return;
        if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
          navigate(`/kasse/abschluss?payment_intent_client_secret=${encodeURIComponent(secret)}`, { replace: true });
        }
      } catch (e) {
        console.error("retrievePaymentIntent:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Paid, but the order is not created yet: never show the pay form again.
  if (paidIntent) return <PaymentReceived paymentIntentId={paidIntent} email={customer.email} />;

  if (items.length === 0)
    return (
      <div className="py-16 text-center text-muted-foreground">
        Warenkorb leer. <Link to="/" className="underline">Weiter einkaufen</Link>
      </div>
    );

  if (!stripePromise) {
    console.error("Stripe is not configured: set VITE_STRIPE_PUBLISHABLE_KEY");
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-destructive">Die Online-Zahlung ist gerade nicht verfügbar.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte versuche es später erneut oder schreib uns an{" "}
          <a href="mailto:info@private-shirt.de" className="underline">info@private-shirt.de</a>.
        </p>
      </div>
    );
  }

  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const code = coupon.trim();
    const { data, error } = await invokeFn("create-payment-intent", {
      items: cartPayload(items),
      couponCode: code || undefined,
      replaceClientSecret: lastAttempt() ?? undefined,
      customer: {
        name: customer.name,
        email: customer.email,
        address: { line1: customer.address, postal_code: customer.postalCode, city: customer.city, country: customer.country },
      },
    });
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    rememberAttempt(data.clientSecret);
    const discount = Number(data.discount ?? 0);
    setCouponInfo(
      !code ? null
        : discount > 0 ? { ok: true, text: `Gutschein ${data.couponCode ?? code.toUpperCase()} angewendet: −${eur(discount)}` }
        : { ok: false, text: `Gutschein „${code}“ wurde nicht angewendet: ${data.couponReason ?? "Code ungültig"}` },
    );
    setServer({
      amount: Number(data.amount),
      subtotal: Number(data.subtotal),
      volumeDiscount: Number(data.volumeDiscount ?? 0),
      discount,
      shipping: Number(data.shipping ?? 0),
      couponCode: data.couponCode ?? null,
    });
    setClientSecret(data.clientSecret);
  }

  function editDetails() {
    setClientSecret(null);
    setServer(null);
  }

  function onPaid(paymentIntentId: string) {
    forgetAttempt();
    clear();
    setPaidIntent(paymentIntentId);
  }

  const set = (k: keyof Customer, v: string) => setCustomer((c) => ({ ...c, [k]: v }));
  const couponNote = couponInfo && (
    <p role={couponInfo.ok ? "status" : "alert"} className={couponInfo.ok ? "text-xs text-secondary-foreground" : "text-sm font-medium text-destructive"}>
      {couponInfo.text}
    </p>
  );

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 shadow-card">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Kasse</h1>
        {!clientSecret && <Link to="/warenkorb" className="text-sm text-muted-foreground underline">Zum Warenkorb</Link>}
      </div>

      <OrderSummary items={items} server={server} />
      <DeliveryTime className="-mt-3 mb-6" />

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
            {couponNote}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Weiter…" : "Weiter zur Zahlung"}
          </Button>
        </form>
      ) : (
        <>
          <div className="mb-4 space-y-2 rounded-xl border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-muted-foreground">
                Lieferung an {customer.name}, {customer.address}, {customer.postalCode} {customer.city}
              </p>
              <button type="button" onClick={editDetails} disabled={paying} className="shrink-0 text-sm underline disabled:opacity-50">
                Angaben ändern
              </button>
            </div>
            {couponNote}
          </div>
          <Elements stripe={stripePromise} options={{ clientSecret, locale: "de", appearance: { theme: "stripe" } }}>
            <PayForm customer={customer} onPaid={onPaid} onBusy={setPaying} />
          </Elements>
        </>
      )}
    </div>
  );
}

function PayForm({ customer, onPaid, onBusy }: {
  customer: Customer;
  onPaid: (paymentIntentId: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const clear = useCart((s) => s.clear);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onBusy(busy), [busy, onBusy]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message ?? "Bitte prüfe deine Zahlungsangaben."); setBusy(false); return; }

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

    // A repeated confirm (e.g. after a lost response) fails although the
    // payment already went through: continue with that payment.
    const alreadyPaid = payErr?.payment_intent?.status === "succeeded" ? payErr.payment_intent : null;
    if (payErr && !alreadyPaid) {
      setError(payErr.message ?? "Die Zahlung ist fehlgeschlagen. Bitte versuche es erneut.");
      setBusy(false);
      return;
    }
    const paid = alreadyPaid ?? paymentIntent;

    const result = await finishPayment(paid?.id, paid?.status);
    if (result.kind === "order") {
      forgetAttempt();
      clear();
      navigate(`/bestellung/${result.orderId}`, {
        state: { total: result.total, itemCount: result.itemCount, email: customer.email, orderNumber: result.orderNumber },
      });
      return;
    }
    if (result.kind === "processing") {
      forgetAttempt();
      clear();
      navigate("/kasse/abschluss?verarbeitung=1");
      return;
    }
    // Money is taken but the order is not created yet: no second payment.
    if (paid?.status === "succeeded") {
      console.error("create-order:", result.message);
      onPaid(paid.id);
      return;
    }
    setError(result.message);
    setBusy(false);
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
