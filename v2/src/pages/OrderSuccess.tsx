import { useParams, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/utils";

interface Confirmation {
  order_number: string | null;
  total: number | null;
  item_count: number;
  email_sent: boolean;
}

/** Order number + mail status for the success page (works after a reload too). */
async function fetchConfirmation(orderId: string): Promise<Confirmation | null> {
  const { data, error } = await supabase.rpc("order_confirmation", { p_order_id: orderId });
  if (error) throw error;
  return (data as unknown as Confirmation | null) ?? null;
}

export default function OrderSuccess() {
  const { orderId } = useParams<{ orderId: string }>();
  const { state } = useLocation() as {
    state?: { total?: string; itemCount?: number; email?: string; orderNumber?: string | null };
  };
  const { data: conf } = useQuery({
    queryKey: ["order-confirmation", orderId],
    queryFn: () => fetchConfirmation(orderId!),
    enabled: !!orderId,
    retry: 1,
  });

  const orderNumber = conf?.order_number ?? state?.orderNumber ?? orderId?.slice(0, 8);
  const itemCount = state?.itemCount ?? conf?.item_count;
  const total = state?.total != null ? Number(state.total) : conf?.total != null ? Number(conf.total) : null;
  const mailNote =
    conf?.email_sent === false
      ? "Die Bestellbestätigung per E-Mail ist noch nicht verschickt. Falls sie nicht in der nächsten Stunde ankommt, schreib uns bitte mit deiner Bestellnummer."
      : state?.email
        ? `Die Bestellbestätigung geht an ${state.email}.`
        : "Die Bestellbestätigung schicken wir dir per E-Mail.";

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
      <h1 className="mt-4 text-3xl font-black lowercase">danke für deine bestellung!</h1>
      <p className="mt-2 text-muted-foreground">deine zahlung war erfolgreich.</p>

      <div className="mt-6 space-y-2 rounded-2xl border bg-card p-6 text-left text-sm shadow-card">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bestellnummer</span>
          <span className="font-mono font-semibold">{orderNumber}</span>
        </div>
        {itemCount != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Artikel</span>
            <span>{itemCount} Stück</span>
          </div>
        )}
        {total != null && (
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Gesamt</span>
            <span className="text-primary">{eur(total)}</span>
          </div>
        )}
        <p className="pt-2 text-xs text-muted-foreground">
          {mailNote}
          {" "}Fragen? <a href="mailto:info@private-shirt.de" className="underline">info@private-shirt.de</a>
        </p>
      </div>

      <Link to="/" className="mt-8 inline-block">
        <Button variant="outline">weiter einkaufen</Button>
      </Link>
    </div>
  );
}
