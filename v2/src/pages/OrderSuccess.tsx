import { useParams, useLocation, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/utils";

export default function OrderSuccess() {
  const { orderId } = useParams<{ orderId: string }>();
  const { state } = useLocation() as { state?: { total?: string; itemCount?: number; email?: string } };

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
      <h1 className="mt-4 text-3xl font-black lowercase">danke für deine bestellung!</h1>
      <p className="mt-2 text-muted-foreground">deine zahlung war erfolgreich.</p>

      <div className="mt-6 space-y-2 rounded-2xl border bg-card p-6 text-left text-sm shadow-card">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bestellnummer</span>
          <span className="font-mono text-xs">{orderId?.slice(0, 8)}</span>
        </div>
        {state?.itemCount != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Artikel</span>
            <span>{state.itemCount} Stück</span>
          </div>
        )}
        {state?.total && (
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Gesamt</span>
            <span className="text-primary">{eur(Number(state.total))}</span>
          </div>
        )}
        <p className="pt-2 text-xs text-muted-foreground">
          {state?.email ? `Die Bestellbestätigung geht an ${state.email}.` : "Die Bestellbestätigung hast du per E-Mail erhalten."}
          {" "}Fragen? <a href="mailto:info@private-shirt.de" className="underline">info@private-shirt.de</a>
        </p>
      </div>

      <Link to="/" className="mt-8 inline-block">
        <Button variant="outline">weiter einkaufen</Button>
      </Link>
    </div>
  );
}
