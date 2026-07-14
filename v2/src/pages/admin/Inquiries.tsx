import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STATUS = ["neu", "in_bearbeitung", "angebot_gesendet", "abgeschlossen"] as const;
const STATUS_LABEL: Record<string, string> = {
  neu: "neu", in_bearbeitung: "in Bearbeitung", angebot_gesendet: "Angebot gesendet", abgeschlossen: "abgeschlossen",
};
const STATUS_CLS: Record<string, string> = {
  neu: "bg-secondary text-secondary-foreground",
  in_bearbeitung: "bg-amber-100 text-amber-800",
  angebot_gesendet: "bg-blue-100 text-blue-800",
  abgeschlossen: "bg-emerald-100 text-emerald-800",
};
const fmt = (s: string) => new Date(s).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });

async function fetchInquiries() {
  const { data, error } = await supabase.from("bulk_inquiries").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function motivUrl(path: string) {
  const { data } = await supabase.storage.from("order-designs").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default function Inquiries() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-inquiries"], queryFn: fetchInquiries });
  const [open, setOpen] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await supabase.from("bulk_inquiries").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-inquiries"] });
  }
  async function openMotiv(path: string) {
    const url = await motivUrl(path);
    if (url) window.open(url, "_blank");
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Großbestellungs-Anfragen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Angebotsanfragen aus dem Großbestellungs-Formular.</p>

      {error && <p className="text-destructive">Tabelle fehlt? SETUP_ALL.sql ausführen. ({(error as Error).message})</p>}
      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="space-y-3">
          {data?.map((q: any) => (
            <li key={q.id} className="rounded-xl border bg-card">
              <button onClick={() => setOpen(open === q.id ? null : q.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent">
                <div className="flex-1">
                  <p className="font-medium">{[q.anrede, q.vorname, q.nachname].filter(Boolean).join(" ") || q.email}{q.firma ? ` · ${q.firma}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{fmt(q.created_at)} · {q.stueckzahl ? `${q.stueckzahl} Stk` : "—"} · {q.textil_art ?? "—"}</p>
                </div>
                <span className={"rounded-full px-2.5 py-0.5 text-xs font-medium " + (STATUS_CLS[q.status] ?? "")}>{STATUS_LABEL[q.status] ?? q.status}</span>
              </button>
              {open === q.id && (
                <div className="space-y-3 border-t px-4 py-4 text-sm">
                  <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    <Field k="E-Mail" v={<a href={`mailto:${q.email}`} className="text-primary hover:underline">{q.email}</a>} />
                    <Field k="Telefon" v={q.telefon || "—"} />
                    <Field k="Filiale" v={q.filiale || "—"} />
                    <Field k="Stückzahl" v={q.stueckzahl || "—"} />
                    <Field k="Textil-Art" v={q.textil_art || "—"} />
                    <Field k="Qualität" v={q.qualitaet || "—"} />
                    <Field k="Druckverfahren" v={q.druckverfahren || "—"} />
                    <Field k="Firma" v={q.firma || "—"} />
                  </div>
                  {q.bemerkungen && <p className="rounded-lg bg-muted/40 p-3 text-muted-foreground">{q.bemerkungen}</p>}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {q.motiv_path && (
                      <button onClick={() => openMotiv(q.motiv_path)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                        <Download className="h-4 w-4" /> Motiv
                      </button>
                    )}
                    <select value={q.status} onChange={(e) => setStatus(q.id, e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                      {STATUS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </li>
          ))}
          {data?.length === 0 && <li className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Anfragen.</li>}
        </ul>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return <p><span className="text-muted-foreground">{k}:</span> {v}</p>;
}
