import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SET_PASSWORD_PATH, useAuth } from "@/lib/auth";
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
  { to: "/admin/anleitung", label: "Anleitung" },
];

const BADGE_HINT: Record<string, string> = {
  "/admin/inventory": "Größen mit niedrigem Bestand oder ausverkauft",
  "/admin/inquiries": "neue Anfragen",
  "/admin/reviews": "Bewertungen warten auf Freigabe",
  "/admin/messages": "unerledigte Nachrichten",
};

/** Counters for the nav: work waiting for the admin. Pages invalidate ["admin-badges"] after changes. */
async function fetchBadges(): Promise<Record<string, number>> {
  const head = { count: "exact", head: true } as const;
  const [inquiries, messages, reviews, lowStock] = await Promise.all([
    supabase.from("bulk_inquiries").select("id", head).eq("status", "neu"),
    supabase.from("contact_messages").select("id", head).eq("handled", false),
    supabase.from("reviews").select("id", head).eq("approved", false),
    supabase.from("low_stock").select("variant_id", head).eq("product_status", "published"),
  ]);
  return {
    "/admin/inquiries": inquiries.count ?? 0,
    "/admin/messages": messages.count ?? 0,
    "/admin/reviews": reviews.count ?? 0,
    "/admin/inventory": lowStock.count ?? 0,
  };
}

export default function AdminLayout() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  // UI gate only — the data itself is protected by RLS via public.is_admin().
  const [adminState, setAdminState] = useState<"checking" | "yes" | "no" | "error">("checking");
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) { setAdminState("checking"); return; }
    let cancelled = false;
    setAdminState("checking");
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (cancelled) return;
      // A failed check (network, expired token) is not the same as "no admin".
      setAdminState(error ? "error" : data === true ? "yes" : "no");
    });
    return () => { cancelled = true; };
  }, [userId, attempt]);

  const { data: badges } = useQuery({
    queryKey: ["admin-badges"],
    queryFn: fetchBadges,
    enabled: adminState === "yes",
    refetchInterval: 60_000,
  });

  if (loading) return <p className="text-muted-foreground">Lade…</p>;
  if (!session) return <Login />;
  if (adminState === "checking") return <p className="text-muted-foreground">Lade…</p>;
  if (adminState === "error")
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-destructive">Der Admin-Zugang konnte gerade nicht geprüft werden. Bitte Verbindung prüfen und erneut versuchen.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => setAttempt((n) => n + 1)}>Erneut versuchen</Button>
          <Button variant="ghost" onClick={() => signOut()}>Abmelden</Button>
        </div>
      </div>
    );
  if (adminState === "no")
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
        {NAV.map((n) => {
          const count = badges?.[n.to] ?? 0;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm",
                  isActive ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              {n.label}
              {count > 0 && (
                <span
                  title={`${count} ${BADGE_HINT[n.to]}`}
                  className={cn(
                    "ml-auto rounded-full px-1.5 text-[11px] font-semibold leading-5",
                    n.to === "/admin/inventory" ? "bg-amber-100 text-amber-800" : "bg-primary text-primary-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </NavLink>
          );
        })}
        <div className="flex shrink-0 gap-1 md:block md:pt-4">
          <Link
            to={SET_PASSWORD_PATH}
            className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Passwort ändern
          </Link>
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
