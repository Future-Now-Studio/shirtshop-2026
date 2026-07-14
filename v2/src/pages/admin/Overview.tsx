import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PAID = ["paid", "in_production", "shipped", "completed"];

async function fetchDashboard() {
  const [products, colors, sizes, orders, items] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("colors").select("*", { count: "exact", head: true }),
    supabase.from("sizes").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("id, status, total, created_at"),
    supabase.from("order_items").select("qty, products(name)"),
  ]);
  const os = orders.data ?? [];
  const paid = os.filter((o) => PAID.includes(o.status));
  const revenue = paid.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const now = Date.now();
  const rev30 = paid.filter((o) => now - new Date(o.created_at).getTime() < 30 * 864e5).reduce((s, o) => s + Number(o.total ?? 0), 0);

  const byProduct: Record<string, number> = {};
  for (const it of items.data ?? []) {
    const name = (it as any).products?.name ?? "—";
    byProduct[name] = (byProduct[name] ?? 0) + it.qty;
  }
  const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    counts: { products: products.count ?? 0, colors: colors.count ?? 0, sizes: sizes.count ?? 0, orders: orders.count ?? os.length },
    revenue, rev30, paidCount: paid.length, avg: paid.length ? revenue / paid.length : 0, top,
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
  const { data } = useQuery({ queryKey: ["admin-dashboard"], queryFn: fetchDashboard });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Übersicht</h1>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Umsatz (bezahlt)" value={data ? eur(data.revenue) : "—"} sub={data ? `${eur(data.rev30)} · 30 Tage` : ""} />
        <Kpi title="Bezahlte Bestellungen" value={data ? String(data.paidCount) : "—"} />
        <Kpi title="Ø Bestellwert" value={data ? eur(data.avg) : "—"} />
        <Kpi title="Bestellungen gesamt" value={data ? String(data.counts.orders) : "—"} />
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
