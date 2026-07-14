import { Heart } from "lucide-react";
import { useWishlist } from "@/stores/wishlist";

export default function HeartButton({ id, className = "" }: { id: string; className?: string }) {
  const ids = useWishlist((s) => s.ids);
  const toggle = useWishlist((s) => s.toggle);
  const active = ids.includes(id);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
      aria-label={active ? "Von Merkliste entfernen" : "Merken"}
      className={"flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105 " + className}
    >
      <Heart className={"h-4.5 w-4.5 " + (active ? "fill-primary text-primary" : "text-muted-foreground")} />
    </button>
  );
}
