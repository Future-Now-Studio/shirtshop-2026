import { AlertTriangle } from "lucide-react";
import type { DesignReview } from "@/lib/designer-print";

/**
 * Druckfreigabe before add-to-cart: texts to proofread, warnings (zone,
 * resolution, placeholder) and the required approval + rights confirmation.
 */
export function PrintApproval({ review, viewLabel, approved, onChange, disabled }: {
  review: DesignReview;
  viewLabel: Record<string, string>;
  approved: boolean;
  onChange: (approved: boolean) => void;
  disabled?: boolean;
}) {
  const hasIssues = review.issues.length > 0;
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-label="Druckfreigabe">
      <p className="text-sm font-medium">Druckfreigabe</p>
      {review.texts.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Bitte prüfe deine Texte auf Rechtschreibung:</p>
          <ul className="mt-1.5 space-y-1">
            {review.texts.map((t, i) => (
              <li key={i} className="break-words rounded-md bg-muted/50 px-2 py-1 text-sm">
                <span className="mr-1 text-xs text-muted-foreground">{viewLabel[t.view] ?? t.view}:</span>„{t.text}“
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasIssues && (
        <ul className="space-y-1.5">
          {review.issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" /> {issue.message}
            </li>
          ))}
        </ul>
      )}
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={approved}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          Ich habe meine Gestaltung (Rechtschreibung, Farben, Platzierung) geprüft und gebe sie so zum Druck frei
          {hasIssues ? " – die Hinweise oben habe ich gelesen" : ""}. Ich besitze die Rechte an den verwendeten Motiven und Texten.
        </span>
      </label>
    </div>
  );
}
