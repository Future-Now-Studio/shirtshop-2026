import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

async function fetchMatrix(productId: string) {
  const [sizes, productSizes, variants, availability] = await Promise.all([
    supabase.from("sizes").select("*").order("sort_order").order("name"),
    supabase.from("product_sizes").select("size_id").eq("product_id", productId),
    supabase.from("variants").select("id, colors(name, hex)").eq("product_id", productId).order("sort_order"),
    supabase
      .from("variant_size_availability")
      .select("variant_id, size_id, available, stock, variants!inner(product_id)")
      .eq("variants.product_id", productId),
  ]);
  for (const r of [sizes, productSizes, variants, availability]) if (r.error) throw r.error;
  return {
    sizes: sizes.data!,
    enabledSizeIds: new Set(productSizes.data!.map((r) => r.size_id)),
    variants: variants.data!,
    avail: availability.data!,
  };
}

export default function SizeMatrix({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const key = ["matrix", productId];
  const { data } = useQuery({ queryKey: key, queryFn: () => fetchMatrix(productId) });

  const toggleProductSize = useMutation({
    mutationFn: async (p: { sizeId: string; enabled: boolean }) => {
      if (p.enabled) {
        const { error } = await supabase.from("product_sizes").delete().match({ product_id: productId, size_id: p.sizeId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_sizes").insert({ product_id: productId, size_id: p.sizeId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const setCell = useMutation({
    mutationFn: async (p: { variantId: string; sizeId: string; available?: boolean; stock?: number }) => {
      const existing = data?.avail.find((a) => a.variant_id === p.variantId && a.size_id === p.sizeId);
      const row = {
        variant_id: p.variantId,
        size_id: p.sizeId,
        available: p.available ?? existing?.available ?? true,
        stock: p.stock ?? existing?.stock ?? 0,
      };
      const { error } = await supabase
        .from("variant_size_availability")
        .upsert(row, { onConflict: "variant_id,size_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (!data) return <p className="text-muted-foreground">Lade…</p>;

  const sizes = data.sizes.filter((s) => data.enabledSizeIds.has(s.id));

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">Verfügbare Größen für dieses Produkt</p>
        <div className="flex flex-wrap gap-2">
          {data.sizes.map((s) => {
            const enabled = data.enabledSizeIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleProductSize.mutate({ sizeId: s.id, enabled })}
                className={
                  "rounded-md border px-3 py-1.5 text-sm " +
                  (enabled ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
                }
              >
                {s.name}
              </button>
            );
          })}
          {data.sizes.length === 0 && <span className="text-sm text-muted-foreground">Erst Größen global anlegen.</span>}
        </div>
      </div>

      {sizes.length > 0 && data.variants.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Bestand pro Farbe × Größe</p>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b px-3 py-2 text-left font-medium">Farbe</th>
                  {sizes.map((s) => (
                    <th key={s.id} className="border-b px-3 py-2 text-center font-medium">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.variants.map((v: any) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: v.colors?.hex }} />
                        {v.colors?.name}
                      </span>
                    </td>
                    {sizes.map((s) => {
                      const cell = data.avail.find((a) => a.variant_id === v.id && a.size_id === s.id);
                      const available = cell?.available ?? false;
                      return (
                        <td key={s.id} className="px-2 py-1.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="checkbox"
                              checked={available}
                              onChange={(e) => setCell.mutate({ variantId: v.id, sizeId: s.id, available: e.target.checked })}
                            />
                            <input
                              type="number"
                              min={0}
                              value={cell?.stock ?? 0}
                              disabled={!available}
                              onChange={(e) =>
                                setCell.mutate({ variantId: v.id, sizeId: s.id, stock: Math.max(0, Number(e.target.value)) })
                              }
                              className="w-14 rounded border border-input bg-background px-1 py-0.5 text-center text-xs disabled:opacity-40"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
