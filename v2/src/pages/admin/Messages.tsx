import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dbErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/components/admin/csv";

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
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-messages"] });
    qc.invalidateQueries({ queryKey: ["admin-badges"] });
  };

  const toggleHandled = useMutation({
    mutationFn: async (m: { id: string; handled: boolean }) => {
      const { error } = await supabase.from("contact_messages").update({ handled: !m.handled }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  // Deletion is final (e.g. a GDPR deletion request); there is no archive.
  const removeMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  // Same effect as the unsubscribe link in the newsletter: the address is removed.
  const removeSubscriber = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  if (isLoading) return <p className="text-muted-foreground">Lade…</p>;

  const confirmed = (data?.subscribers ?? []).filter((s) => s.confirmed_at);
  const failed = toggleHandled.error ?? removeMessage.error ?? removeSubscriber.error;

  return (
    <div className="max-w-3xl space-y-10">
      {failed && <p role="alert" className="text-sm text-destructive">Aktion fehlgeschlagen: {dbErrorMessage(failed)}</p>}
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Kontakt-Nachrichten</h1>
        <p className="mb-4 text-sm text-muted-foreground">{data?.messages.length ?? 0} Nachrichten</p>
        <ul className="divide-y rounded-lg border">
          {data?.messages.map((m) => (
            <li key={m.id} className={"p-4 " + (m.handled ? "opacity-60" : "")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{m.name} <a href={`mailto:${m.email}`} className="text-sm font-normal text-primary hover:underline">{m.email}</a></p>
                  <p className="text-xs text-muted-foreground">{fmt(m.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleHandled.mutate(m)}>
                    <Check className="mr-1 h-4 w-4" /> {m.handled ? "erledigt" : "als erledigt"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Nachricht löschen"
                    aria-label={`Nachricht von ${m.name} löschen`}
                    onClick={() => confirm(`Nachricht von „${m.name}“ endgültig löschen?`) && removeMessage.mutate(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{m.message}</p>
            </li>
          ))}
          {data?.messages.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Nachrichten.</li>}
        </ul>
      </div>

      <div>
        <h2 className="mb-1 text-2xl font-semibold">Newsletter</h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {confirmed.length} bestätigt · {(data?.subscribers.length ?? 0) - confirmed.length} unbestätigt
            {" "}— nur bestätigte Adressen dürfen angeschrieben werden.
          </p>
          <button
            type="button"
            disabled={confirmed.length === 0}
            onClick={() =>
              downloadCsv(
                "newsletter-bestaetigt.csv",
                [["email", "bestaetigt_am"], ...confirmed.map((s) => [s.email, s.confirmed_at])],
                ","
              )
            }
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
          >
            Bestätigte als CSV
          </button>
        </div>
        <ul className="divide-y rounded-lg border">
          {data?.subscribers.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">{s.email}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {s.confirmed_at
                  ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">bestätigt</span>
                  : <span className="rounded-full bg-muted px-2 py-0.5">unbestätigt</span>}
                {fmt(s.created_at)}
                <button
                  type="button"
                  title="Abonnent entfernen"
                  aria-label={`${s.email} entfernen`}
                  onClick={() => confirm(`${s.email} aus dem Newsletter entfernen? Die Adresse wird gelöscht.`) && removeSubscriber.mutate(s.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
          {data?.subscribers.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Noch keine Abonnenten.</li>}
        </ul>
      </div>
    </div>
  );
}
