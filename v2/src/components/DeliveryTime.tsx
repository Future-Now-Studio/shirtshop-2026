import { Truck } from "lucide-react";
import { useShopConfig } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** Lieferzeit notice (configured in Admin → Einstellungen, via shop_config()). */
export function DeliveryTime({ className }: { className?: string }) {
  const cfg = useShopConfig();
  return (
    <p className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Lieferzeit: {cfg.deliveryTime}</span>
    </p>
  );
}
