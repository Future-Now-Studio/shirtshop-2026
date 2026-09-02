import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Minus, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { createOrder, getCompany, getProducts } from '@/lib/api'
import { formatEUR, grossFrom, repriceLine, shippingFor, VAT_RATE } from '@/lib/utils'
import type { CartLine, Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'

export interface OrderConfirmOpts {
  defaultNote?: string
  title?: string
  submitLabel?: string
  onPlaced?: (order: Order) => void
}

export function OrderConfirmDialog({
  lines,
  opts,
  onClose,
}: {
  lines: CartLine[]
  opts: OrderConfirmOpts
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts })

  const [rows, setRows] = useState<CartLine[]>(() => lines.map((l) => ({ ...l })))
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [note, setNote] = useState(opts.defaultNote ?? '')

  // Editable delivery address, prefilled from the company profile once loaded.
  const addr = company?.deliveryAddress ?? company?.billingAddress
  const [delLine, setDelLine] = useState('')
  const [delZip, setDelZip] = useState('')
  const [delCity, setDelCity] = useState('')
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (addr && !prefilled) {
      setDelLine(addr.line1)
      setDelZip(addr.zip)
      setDelCity(addr.city)
      setPrefilled(true)
    }
  }, [addr, prefilled])

  // Always re-resolve unit prices against the current Staffel + company
  // discount, so merged or edited quantities land on the right tier.
  const discount = company?.discountPercent ?? 0
  const priced = useMemo(
    () => rows.map((r) => repriceLine(r, products, discount)),
    [rows, products, discount],
  )
  const activeRows = priced.filter((r) => r.quantity > 0)
  const net = useMemo(
    () => activeRows.reduce((s, r) => s + r.unitPrice * r.quantity, 0),
    [activeRows],
  )
  const shipping = shippingFor(net)
  const vat = Math.round((net + shipping) * VAT_RATE * 100) / 100
  const gross = grossFrom(net + shipping)
  const totalQty = activeRows.reduce((s, r) => s + r.quantity, 0)

  function setQty(idx: number, q: number) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, quantity: Math.max(0, q) } : r)))
  }
  function setLineField(idx: number, patch: Partial<CartLine>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const place = useMutation({
    mutationFn: () => {
      const parts: string[] = []
      if (poNumber.trim()) parts.push(`Bestellzeichen: ${poNumber.trim()}`)
      if (deliveryDate) {
        parts.push(`Wunschtermin: ${new Date(deliveryDate).toLocaleDateString('de-DE')}`)
      }
      if (delLine.trim()) parts.push(`Lieferung: ${delLine.trim()}, ${delZip.trim()} ${delCity.trim()}`)
      if (note.trim()) parts.push(note.trim())
      return createOrder(activeRows, parts.join(' · ') || undefined)
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      opts.onPlaced?.(order)
      onClose()
      navigate(`/bestellung-erfolg/${order.id}`)
    },
  })

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold tracking-tight">{opts.title ?? 'Bestellung prüfen & absenden'}</h2>
            <p className="text-sm text-muted-foreground">
              Menge, Rechnungs- und Lieferdaten bestätigen.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Schließen">
            <X className="size-5" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Positions */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Positionen &amp; Mengen
            </h3>
            <div className="mt-2 divide-y divide-border rounded-lg border border-border">
              {priced.map((r, i) => (
                <div key={`${r.productId}-${r.color}-${r.size}`} className="p-3">
                  <div className="flex items-center gap-3">
                    <img src={r.imageUrl} alt="" className="size-11 rounded-md border border-border object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.color} · Größe {r.size} · {formatEUR(r.unitPrice)}
                      </p>
                    </div>
                    <div className="flex h-8 items-center rounded-lg border border-input">
                      <button onClick={() => setQty(i, r.quantity - 1)} className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Weniger">
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={r.quantity}
                        onChange={(e) => setQty(i, Number(e.target.value) || 0)}
                        className="h-8 w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => setQty(i, r.quantity + 1)} className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Mehr">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-medium">
                      {formatEUR(r.unitPrice * r.quantity)}
                    </span>
                    <button onClick={() => setQty(i, 0)} className="text-muted-foreground hover:text-destructive" aria-label="Position entfernen">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {/* #12 Druck & Veredelung */}
                  <div className="mt-2 grid grid-cols-1 gap-2 pl-14 sm:grid-cols-2">
                    <input
                      value={r.printPosition ?? ''}
                      onChange={(e) => setLineField(i, { printPosition: e.target.value })}
                      placeholder="Druckposition (z. B. Brust links, Rücken)"
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:border-ring focus:outline-none"
                    />
                    <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-input px-2 text-xs text-muted-foreground hover:bg-muted">
                      <Paperclip className="size-3.5" />
                      <span className="truncate">{r.artworkName ?? 'Druckdatei anhängen'}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.svg,.ai,.eps,.jpg,.jpeg"
                        onChange={(e) => setLineField(i, { artworkName: e.target.files?.[0]?.name })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Billing (read-only) */}
          {company && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rechnung an
              </h3>
              <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{company.company}</p>
                {company.billingAddress && (
                  <p className="text-muted-foreground">
                    {company.billingAddress.line1}, {company.billingAddress.zip}{' '}
                    {company.billingAddress.city}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Kd-Nr. {company.customerNumber ?? '—'}
                  {company.vatId ? ` · USt-IdNr. ${company.vatId}` : ''}
                  {company.paymentTerms ? ` · ${company.paymentTerms}` : ''}
                </p>
              </div>
            </section>
          )}

          {/* Delivery + meta */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="del-line">Lieferadresse</Label>
              <Input id="del-line" value={delLine} onChange={(e) => setDelLine(e.target.value)} placeholder="Straße und Hausnummer" />
            </div>
            <div>
              <Label htmlFor="del-zip">PLZ</Label>
              <Input id="del-zip" value={delZip} onChange={(e) => setDelZip(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="del-city">Ort</Label>
              <Input id="del-city" value={delCity} onChange={(e) => setDelCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="po">Bestellzeichen / PO (optional)</Label>
              <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="z. B. PO-2026-114" />
            </div>
            <div>
              <Label htmlFor="dd">Wunschtermin (optional)</Label>
              <Input id="dd" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="note">Anmerkung (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Druckposition, Konfektionierung…" />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Zwischensumme netto ({totalQty} Stück)</span>
              <span>{formatEUR(net)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Versand {shipping === 0 ? '(frei ab 500 €)' : ''}</span>
              <span>{shipping === 0 ? 'kostenlos' : formatEUR(shipping)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>zzgl. 19 % USt.</span>
              <span>{formatEUR(vat)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>Gesamt (brutto)</span>
              <span>{formatEUR(gross)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={place.isPending}>
              Abbrechen
            </Button>
            <Button
              variant="brand"
              className="flex-1"
              onClick={() => place.mutate()}
              disabled={place.isPending || totalQty === 0}
            >
              {place.isPending && <Loader2 className="size-4 animate-spin" />}
              {opts.submitLabel ?? 'Verbindlich bestellen'}
            </Button>
          </div>
          {place.isError && (
            <p className="mt-2 text-center text-xs text-destructive">
              Bestellung fehlgeschlagen. Bitte erneut versuchen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
