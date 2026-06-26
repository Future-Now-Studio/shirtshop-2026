import { useParams, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderSuccess() {
  const { orderId } = useParams<{ orderId: string }>();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
      <h1 className="mt-4 text-2xl font-semibold">Danke für deine Bestellung!</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Deine Zahlung war erfolgreich. Bestellnummer:
      </p>
      <p className="mt-1 font-mono text-sm">{orderId}</p>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="outline">Weiter einkaufen</Button>
      </Link>
    </div>
  );
}
