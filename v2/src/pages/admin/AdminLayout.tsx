import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Login from "./Login";

const NAV = [
  { to: "/admin", label: "Übersicht", end: true },
  { to: "/admin/orders", label: "Bestellungen" },
  { to: "/admin/products", label: "Produkte" },
  { to: "/admin/inventory", label: "Bestand" },
  { to: "/admin/colors", label: "Farben" },
  { to: "/admin/sizes", label: "Größen" },
  { to: "/admin/discounts", label: "Rabatte" },
  { to: "/admin/coupons", label: "Gutscheine" },
  { to: "/admin/inquiries", label: "Anfragen" },
  { to: "/admin/reviews", label: "Bewertungen" },
  { to: "/admin/messages", label: "Nachrichten" },
  { to: "/admin/settings", label: "Einstellungen" },
];

export default function AdminLayout() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  // UI gate only — the data itself is protected by RLS via public.is_admin().
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc("is_admin").then(({ data, error }) => setIsAdmin(!error && data === true));
  }, [session]);

  if (loading) return <p className="text-muted-foreground">Lade…</p>;
  if (!session) return <Login />;
  if (isAdmin === null) return <p className="text-muted-foreground">Lade…</p>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-destructive">Kein Admin-Zugriff für dieses Konto.</p>
        <Button variant="ghost" className="mt-4" onClick={() => signOut()}>
          Abmelden
        </Button>
      </div>
    );

  return (
    <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8">
      {/* Phones: horizontally scrollable nav row; md+: sidebar */}
      <aside className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 pb-2 md:mx-0 md:mb-0 md:block md:space-y-1 md:overflow-visible md:px-0 md:pb-0">
        <div className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:block">
          Admin
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                "block shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm",
                isActive ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
        <div className="shrink-0 md:pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={async () => {
              await signOut();
              navigate("/admin");
            }}
          >
            Abmelden
          </Button>
        </div>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
