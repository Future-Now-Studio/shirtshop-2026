import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

async function fetchData() {
  const [msgs, subs] = await Promise.all([
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
    supabase.from("newsletter_subscribers").select("*").order("created_at", { ascending: false }),
  ]);
  if (msgs.error) throw msgs.error;
  if (subs.error) throw subs.error;
  return { messages: msgs.data, subscribers: subs.data };
}

function fmt(s: string) {
  return new Date(s).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default function Messages() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-messages"], queryFn: fetchData });

  const toggleHandled = useMutation({
    mutationFn: async (m: { id: string; handled: boolean }) => {
      const { error } = await supabase.from("contact_messages").update({ handled: !m.handled }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  if (isLoading) return <p className="text-muted-foreground">Lade…</p>;

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Kontakt-Nachrichten</h1>
        <p className="mb-4 text-sm text-muted-foreground">{data?.messages.length ?? 0} Nachrichten</p>
        <ul className="divide-y rounded-lg border">
          {data?.messages.map((m) => (
            <li key={m.id} className={"p-4 " + (m.handled ? "opacity-60" : "")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{m.name} <a href={`mailto:${m.email}`} className="text-sm font-normal text-primary hover:underline">{m.email}</a></p>
                  <p className="text-xs text-muted-foreground">{fmt(m.created_at)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleHandled.mutate(m)}>
                  <Check className="mr-1 h-4 w-4" /> {m.handled ? "erledigt" : "als erledigt"}
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{m.message}</p>
            </li>
          ))}
          {data?.messages.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Nachrichten.</li>}
        </ul>
      </div>

      <div>
        <h2 className="mb-1 text-2xl font-semibold">Newsletter</h2>
        <p className="mb-4 text-sm text-muted-foreground">{data?.subscribers.length ?? 0} Abonnenten</p>
        <ul className="divide-y rounded-lg border">
          {data?.subscribers.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{s.email}</span>
              <span className="text-xs text-muted-foreground">{fmt(s.created_at)}</span>
            </li>
          ))}
          {data?.subscribers.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Noch keine Abonnenten.</li>}
        </ul>
      </div>
    </div>
  );
}
