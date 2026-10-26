import { useQuery } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, eur } from "@/lib/utils";

export interface VolumeTier { minQty: number; percent: number }

async function fetchVolumeTiers(): Promise<VolumeTier[]> {
  const { data, error } = await supabase.from("volume_discounts").select("min_qty, discount_percent").order("min_qty");
  if (error) throw error;
  return (data ?? [])
    .map((d) => ({ minQty: Number(d.min_qty), percent: Number(d.discount_percent) }))
    .filter((t) => t.minQty > 0 && t.percent > 0);
}

/** Volume-discount tiers (Admin → Mengenrabatte), ascending by quantity. */
export function useVolumeTiers(): VolumeTier[] {
  const { data } = useQuery({ queryKey: ["volume-tiers"], queryFn: fetchVolumeTiers, staleTime: 5 * 60_000 });
  return data ?? [];
}

export const percentLabel = (n: number) => `${n.toLocaleString("de-DE")} %`;

/** "ab 10 Stück 5 %, ab 25 Stück 10 %" for running text. */
export const tiersText = (tiers: VolumeTier[]) =>
  tiers.map((t) => `ab ${t.minQty} Stück ${percentLabel(t.percent)}`).join(", ");

/**
 * Tier list plus a "noch N Stück bis X %" nudge for the quantity being
 * configured. The cart applies the tier to all eligible pieces together,
 * the same rule as computeTotals() / the checkout server.
 */
export function VolumeTiers({ qty, unitPrice, excluded, className }: {
  qty: number;
  unitPrice?: number;
  excluded?: boolean;
  className?: string;
}) {
  const tiers = useVolumeTiers();
  if (excluded || tiers.length === 0) return null;
  const active = [...tiers].reverse().find((t) => t.minQty <= qty);
  const next = tiers.find((t) => t.minQty > qty);

  return (
    <div className={cn("rounded-xl border bg-muted/30 p-3 text-sm", className)}>
      <p className="flex items-center gap-1.5 font-medium">
        <Percent className="h-4 w-4 text-primary" aria-hidden="true" /> Mengenrabatt
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
        {tiers.map((t) => (
          <li key={t.minQty} className={t === active ? "font-semibold text-primary" : undefined}>
            ab {t.minQty} Stück −{percentLabel(t.percent)}
          </li>
        ))}
      </ul>
      {(active || (next && qty > 0)) && (
        <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
          {active && (
            <>
              −{percentLabel(active.percent)} aktiv
              {unitPrice != null && <> · {eur(unitPrice * (1 - active.percent / 100))} pro Stück</>}.{" "}
            </>
          )}
          {next && qty > 0 && <>Noch {next.minQty - qty} Stück bis −{percentLabel(next.percent)}. </>}
          Gezählt werden alle rabattfähigen Artikel im Warenkorb.
        </p>
      )}
    </div>
  );
}
