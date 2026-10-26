import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Offer to restore the locally autosaved design of this product. */
export function DraftBanner({ savedAt, count, onRestore, onDiscard }: {
  savedAt: number;
  count: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const when = new Date(savedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  return (
    <div role="status" className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <History className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
      <p className="flex-1 text-sm">
        <span className="font-medium">Du hast einen gespeicherten Entwurf</span> vom {when} ({count} Element{count === 1 ? "" : "e"}).
        <span className="text-muted-foreground"> Beim Wiederherstellen wird die aktuelle Gestaltung ersetzt.</span>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={onRestore}>Entwurf wiederherstellen</Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>Verwerfen</Button>
      </div>
    </div>
  );
}
