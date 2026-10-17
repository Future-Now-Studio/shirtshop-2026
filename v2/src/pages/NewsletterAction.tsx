import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeFn } from "@/lib/functions";

/** Landing page for the newsletter confirm / unsubscribe links. */
export default function NewsletterAction({ action }: { action: "confirm" | "unsubscribe" }) {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    invokeFn("newsletter", { action, token: params.get("token") ?? "" }).then(({ error }) => {
      if (error) { setMessage(error); setState("error"); } else setState("ok");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {state === "loading" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
      {state === "ok" && (
        <>
          <h1 className="text-3xl font-black lowercase">
            {action === "confirm" ? "anmeldung bestätigt." : "abgemeldet."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {action === "confirm"
              ? "Danke! Ab jetzt bekommst du unseren Newsletter."
              : "Du erhältst keinen Newsletter mehr von uns."}
          </p>
        </>
      )}
      {state === "error" && <p role="alert" className="text-destructive">{message}</p>}
      <Link to="/" className="mt-8 inline-block"><Button variant="outline">zur startseite</Button></Link>
    </div>
  );
}
