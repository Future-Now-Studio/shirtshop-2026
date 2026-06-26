import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    // 23505 = already subscribed — treat as success
    if (!error || error.code === "23505") {
      setState("ok");
      setEmail("");
    } else {
      setState("error");
    }
  }

  if (state === "ok") return <p className="text-sm text-muted-foreground">Danke! Du bist angemeldet. 🎉</p>;

  return (
    <form onSubmit={submit} className="flex max-w-sm gap-2">
      <Input
        type="email"
        required
        placeholder="Deine E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="bg-background"
      />
      <Button type="submit">Abonnieren</Button>
    </form>
  );
}
