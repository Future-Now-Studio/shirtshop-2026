import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OrderStats {
  order_count: number;
  paid_count: number;
  open_count: number;
  review_count: number;
  revenue: number;
  revenue_30d: number;
  top_products: { name: string; qty: number }[];
}

async function fetchDashboard() {
  // Order figures are computed in SQL over all orders (no 1000-row cap);
  // cancelled and refunded orders do not count as sales.
  const [products, colors, sizes, stats] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("colors").select("*", { count: "exact", head: true }),
    supabase.from("sizes").select("*", { count: "exact", head: true }),
    supabase.rpc("admin_order_stats"),
  ]);
  if (stats.error) throw stats.error;
  const s = stats.data as unknown as OrderStats;
  const revenue = Number(s.revenue ?? 0);
  return {
    counts: { products: products.count ?? 0, colors: colors.count ?? 0, sizes: sizes.count ?? 0, orders: s.order_count ?? 0 },
    revenue,
    rev30: Number(s.revenue_30d ?? 0),
    paidCount: s.paid_count ?? 0,
    openCount: s.open_count ?? 0,
    reviewCount: s.review_count ?? 0,
    avg: s.paid_count ? revenue / s.paid_count : 0,
    top: (s.top_products ?? []).map((p) => [p.name, p.qty] as [string, number]),
  };
}

const LINKS = [
  { key: "products", label: "Produkte", to: "/admin/products" },
  { key: "orders", label: "Bestellungen", to: "/admin/orders" },
  { key: "colors", label: "Farben", to: "/admin/colors" },
  { key: "sizes", label: "Größen", to: "/admin/sizes" },
] as const;

const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function Overview() {
  const { data, error } = useQuery({ queryKey: ["admin-dashboard"], queryFn: fetchDashboard });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Übersicht</h1>
      {error && <p className="mb-4 text-sm text-destructive">Kennzahlen konnten nicht geladen werden.</p>}

      {data && (data.reviewCount > 0 || data.openCount > 0) && (
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          {data.reviewCount > 0 && (
            <Link to="/admin/orders?status=review" className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 hover:bg-amber-100">
              <AlertTriangle className="h-4 w-4" /> {data.reviewCount} {data.reviewCount === 1 ? "Bestellung muss" : "Bestellungen müssen"} geprüft werden
            </Link>
          )}
          {data.openCount > 0 && (
            <Link to="/admin/orders" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-accent">
              {data.openCount} {data.openCount === 1 ? "Bestellung" : "Bestellungen"} in Bearbeitung (bezahlt, noch nicht versendet)
            </Link>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Umsatz brutto (bezahlt)" value={data ? eur(data.revenue) : "—"} sub={data ? `${eur(data.rev30)} · 30 Tage · inkl. Versand, abzgl. Erstattungen` : ""} />
        <Kpi title="Bezahlte Bestellungen" value={data ? String(data.paidCount) : "—"} />
        <Kpi title="Ø Bestellwert (brutto)" value={data ? eur(data.avg) : "—"} />
        <Kpi title="Bestellungen gesamt" value={data ? String(data.counts.orders) : "—"} sub="inkl. offener, stornierter und erstatteter" />
      </div>

      {/* Top products */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Top-Produkte (verkaufte Teile)</CardTitle></CardHeader>
          <CardContent>
            {data?.top.length ? (
              <ul className="space-y-2">
                {data.top.map(([name, qty], i) => (
                  <li key={name} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1 truncate">{name}</span>
                    <span className="font-semibold tabular-nums">{qty}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Noch keine Verkäufe.</p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 content-start">
          {LINKS.map((l) => (
            <Link key={l.key} to={l.to}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{l.label}</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-semibold tabular-nums">{data?.counts[l.key as keyof typeof data.counts] ?? "—"}</p></CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
