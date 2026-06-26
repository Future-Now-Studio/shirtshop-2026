import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchCounts() {
  const tables = ["products", "colors", "sizes", "orders"] as const;
  const entries = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      return [t, count ?? 0] as const;
    })
  );
  return Object.fromEntries(entries) as Record<(typeof tables)[number], number>;
}

const LABELS: Record<string, { label: string; to: string }> = {
  products: { label: "Produkte", to: "/admin/products" },
  colors: { label: "Farben", to: "/admin/colors" },
  sizes: { label: "Größen", to: "/admin/sizes" },
  orders: { label: "Bestellungen", to: "/admin" },
};

export default function Overview() {
  const { data } = useQuery({ queryKey: ["admin-counts"], queryFn: fetchCounts });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Übersicht</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(LABELS).map(([key, { label, to }]) => (
          <Link key={key} to={to}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{data?.[key as keyof typeof data] ?? "—"}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
