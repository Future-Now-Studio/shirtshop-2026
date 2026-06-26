import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Login from "./Login";

const NAV = [
  { to: "/admin", label: "Übersicht", end: true },
  { to: "/admin/orders", label: "Bestellungen" },
  { to: "/admin/products", label: "Produkte" },
  { to: "/admin/colors", label: "Farben" },
  { to: "/admin/sizes", label: "Größen" },
  { to: "/admin/discounts", label: "Rabatte" },
];

export default function AdminLayout() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <p className="text-muted-foreground">Lade…</p>;
  if (!session) return <Login />;

  return (
    <div className="grid grid-cols-[200px_1fr] gap-8">
      <aside className="space-y-1">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                "block rounded-md px-3 py-2 text-sm",
                isActive ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
        <div className="pt-4">
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
      <section>
        <Outlet />
      </section>
    </div>
  );
}
