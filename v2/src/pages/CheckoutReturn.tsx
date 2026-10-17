import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Clock } from "lucide-react";
import { stripePromise } from "@/lib/stripe";
import { useCart } from "@/stores/cart";
import { Button } from "@/components/ui/button";
import { finishPayment } from "@/pages/Checkout";

/**
 * Return page for payment methods with a redirect (Klarna, giropay, …) and the
 * "payment is processing" notice (SEPA). Stripe appends
 * ?payment_intent=…&payment_intent_client_secret=… to the return_url.
 */
export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const clear = useCart((s) => s.clear);
  const [state, setState] = useState<"loading" | "processing" | "error">(
    params.get("verarbeitung") ? "processing" : "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (state !== "loading") return;
    const secret = params.get("payment_intent_client_secret");
    if (!secret || !stripePromise) {
      setState("error");
      setMessage("Zahlungsdaten fehlen. Bitte prüfe deinen Warenkorb.");
      return;
    }
    (async () => {
      const stripe = await stripePromise;
      const { paymentIntent } = (await stripe!.retrievePaymentIntent(secret)) ?? {};
      const result = await finishPayment(paymentIntent?.id, paymentIntent?.status);
      if (result.kind === "order") {
        clear();
        navigate(`/bestellung/${result.orderId}`, { replace: true, state: { total: result.total, itemCount: result.itemCount } });
      } else if (result.kind === "processing") {
        clear();
        setState("processing");
      } else {
        setState("error");
        setMessage(result.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading")
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> Zahlung wird geprüft…
      </div>
    );

  if (state === "processing")
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Clock className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 text-3xl font-black lowercase">zahlung wird verarbeitet</h1>
        <p className="mt-2 text-muted-foreground">
          Deine Zahlung ist unterwegs. Sobald sie bei uns eingegangen ist, legen wir die Bestellung an und
          schicken dir die Bestätigung per E-Mail.
        </p>
        <Link to="/" className="mt-8 inline-block"><Button variant="outline">zur startseite</Button></Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">Zahlung nicht abgeschlossen</h1>
      <p role="alert" className="mt-2 text-muted-foreground">{message}</p>
      <Link to="/kasse" className="mt-8 inline-block"><Button>zurück zur kasse</Button></Link>
    </div>
  );
}
