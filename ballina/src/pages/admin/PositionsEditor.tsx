import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { formatDecimal, parseDecimal } from './adminFormat'

/** One editable position (manual order / quote); numbers kept as typed text. */
export interface PositionRow {
  productName: string
  color: string
  size: string
  quantity: string
  unitPrice: string
}

export const emptyPositionRow: PositionRow = { productName: '', color: '', size: '', quantity: '10', unitPrice: '' }

export interface ParsedPosition {
  productName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
}

/** Row → position, or null while it is incomplete/invalid. */
export function parsePositionRow(r: PositionRow): ParsedPosition | null {
  const quantity = Number(r.quantity)
  const unitPrice = parseDecimal(r.unitPrice)
  if (!r.productName.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return null
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) return null
  return {
    productName: r.productName.trim(),
    color: r.color.trim(),
    size: r.size.trim(),
    quantity,
    unitPrice: Math.round(unitPrice * 100) / 100,
  }
}

const started = (r: PositionRow) => !!(r.productName.trim() || r.unitPrice.trim())

/** Valid positions plus counts the forms need for their checks. */
export function summarizePositions(rows: PositionRow[]) {
  const parsed = rows.filter(started).map(parsePositionRow)
  const items = parsed.filter((p): p is ParsedPosition => p !== null)
  return {
    items,
    invalidRows: parsed.length - items.length,
    zeroRows: items.filter((it) => it.unitPrice === 0).length,
    total: items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
  }
}

/** Existing items → editable rows (prices as "29,90"). */
export function rowsFromItems(items: { productName: string; color: string; size: string; quantity: number; unitPrice: number }[]): PositionRow[] {
  return items.length
    ? items.map((it) => ({
        productName: it.productName,
        color: it.color,
        size: it.size,
        quantity: String(it.quantity),
        unitPrice: formatDecimal(it.unitPrice),
      }))
    : [{ ...emptyPositionRow }]
}

export function PositionsEditor({
  rows,
  onChange,
  placeholders = {},
}: {
  rows: PositionRow[]
  onChange: (rows: PositionRow[]) => void
  placeholders?: Partial<Record<'productName' | 'color' | 'size', string>>
}) {
  function setRow(i: number, patch: Partial<PositionRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <>
      <div className="mt-3 space-y-3">
        {rows.map((r, i) => {
          const bad = started(r) && !parsePositionRow(r)
          return (
            <div key={i} className="grid grid-cols-12 items-end gap-2 border-b border-border pb-3 last:border-0 xl:border-0 xl:pb-0">
              <div className="col-span-12 xl:col-span-3">
                <Label className={i === 0 ? '' : 'xl:hidden'}>Artikel</Label>
                <Input value={r.productName} onChange={(e) => setRow(i, { productName: e.target.value })} placeholder={placeholders.productName} maxLength={200} />
              </div>
              <div className="col-span-6 sm:col-span-3 xl:col-span-2">
                <Label className={i === 0 ? '' : 'xl:hidden'}>Farbe</Label>
                <Input value={r.color} onChange={(e) => setRow(i, { color: e.target.value })} placeholder={placeholders.color} maxLength={100} />
              </div>
              <div className="col-span-6 sm:col-span-3 xl:col-span-2">
                <Label className={i === 0 ? '' : 'xl:hidden'}>Größe</Label>
                <Input value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} placeholder={placeholders.size} maxLength={50} />
              </div>
              <div className="col-span-5 sm:col-span-2 xl:col-span-2">
                <Label className={i === 0 ? '' : 'xl:hidden'}>Menge</Label>
                <Input type="number" min={1} max={100000} step={1} value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} aria-invalid={bad || undefined} />
              </div>
              <div className="col-span-5 sm:col-span-3 xl:col-span-2">
                <Label className={i === 0 ? '' : 'xl:hidden'}>€/Stück netto</Label>
                <Input inputMode="decimal" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: e.target.value })} placeholder="0,00" aria-invalid={bad || undefined} />
              </div>
              <div className="col-span-2 flex justify-end sm:col-span-1">
                <button
                  type="button"
                  onClick={() => onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows)}
                  className="grid size-9 place-items-center text-muted-foreground hover:text-destructive"
                  aria-label="Position entfernen"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {bad && (
                <p className="col-span-12 text-xs text-destructive">
                  Bitte Artikel, eine ganze Menge (1–100.000) und einen Preis (z. B. 12,50) angeben.
                </p>
              )}
            </div>
          )
        })}
      </div>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => onChange([...rows, { ...emptyPositionRow }])}>
        <Plus className="size-4" /> Position hinzufügen
      </Button>
    </>
  )
}

/** Checkbox to explicitly confirm 0 € positions (shown only when there are some). */
export function ZeroPriceConfirm({ count, checked, onChange }: { count: number; checked: boolean; onChange: (v: boolean) => void }) {
  if (!count) return null
  return (
    <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {count === 1 ? '1 Position hat' : `${count} Positionen haben`} den Preis 0 €. Ich bestätige, dass
        {count === 1 ? ' diese Position' : ' diese Positionen'} kostenlos {count === 1 ? 'ist' : 'sind'}.
      </span>
    </label>
  )
}
