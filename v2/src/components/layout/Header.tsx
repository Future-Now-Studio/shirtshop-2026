import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, Menu, X, Heart } from "lucide-react";
import { useCart } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/group-25.svg";

function WishlistLink() {
  const count = useWishlist((s) => s.ids.length);
  return (
    <Link to="/wunschliste" className="relative flex items-center text-muted-foreground transition-colors hover:text-primary" aria-label="Merkliste">
      <Heart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">{count}</span>
      )}
    </Link>
  );
}

const LINKS = [
  { to: "/selbst-gestalten", label: "selbst gestalten" },
  { to: "/produkte", label: "produkte" },
  { to: "/filialen", label: "filialen" },
  { to: "/unternehmen", label: "über uns" },
  { to: "/leistungen", label: "leistungen" },
  { to: "/grossbestellung", label: "großbestellung" },
  { to: "/kontakt", label: "kontakt" },
];

function CartLink() {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  return (
    <Link to="/warenkorb" className="relative flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary">
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { session } = useAuth();

  return (
    <header className="glass-nav sticky top-0 z-40">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
          <img src={logo} alt="Private Shirt" className="h-8 w-auto" />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-5 text-sm font-medium lowercase lg:flex">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-muted-foreground transition-colors hover:text-primary">{l.label}</Link>
          ))}
          <WishlistLink />
          <CartLink />
          {session && <Link to="/admin" className="text-muted-foreground transition-colors hover:text-primary">admin</Link>}
        </nav>

        {/* mobile controls */}
        <div className="flex items-center gap-4 lg:hidden">
          <WishlistLink />
          <CartLink />
          <button onClick={() => setOpen((v) => !v)} aria-label="Menü" className="text-foreground">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {open && (
        <nav className="border-t bg-background lg:hidden">
          <div className="container flex flex-col py-2 text-sm font-medium lowercase">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={"rounded-lg px-2 py-3 " + (pathname === l.to ? "text-primary" : "text-muted-foreground hover:bg-accent")}
              >
                {l.label}
              </Link>
            ))}
            {session && <Link to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-muted-foreground hover:bg-accent">admin</Link>}
          </div>
        </nav>
      )}
    </header>
  );
}
