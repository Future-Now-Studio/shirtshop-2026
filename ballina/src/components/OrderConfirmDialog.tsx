import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Minus, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { acceptQuote, createOrder, getCompany, type OrderMeta } from '@/lib/api'
import { ARTWORK_ACCEPT, artworkProblem } from '@/lib/artwork'
import {
  berlinDate,
  formatDate,
  formatEUR,
  FREE_SHIPPING_FROM,
  grossFrom,
  vatFrom,
  ITEM_PLACEHOLDER,
  shippingFor,
  VAT_RATE,
} from '@/lib/utils'
import type { Address, CartLine, Order, Quote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'

export interface OrderConfirmOpts {
  defaultNote?: string
  /** Delivery address to prefill (e.g. the one of the reordered order). */
  defaultDelivery?: Address
  title?: string
  submitLabel?: string
  /** Accept this quote instead of placing a new order (positions read-only). */
  quote?: Quote
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
  const quote = opts.quote
  const readOnly = !!quote

  // Prices shown are the stored ones (previous order / quote). The server
  // prices a reorder itself (create_order) and flags anything it cannot
  // confirm; a quote is ordered exactly at its own prices (accept_quote).
  const [rows, setRows] = useState<CartLine[]>(() => lines.map((l) => ({ ...l })))
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [note, setNote] = useState(opts.defaultNote ?? '')
  const [formError, setFormError] = useState('')
  const today = berlinDate()

  // Editable delivery address, prefilled once (order → company default → billing).
  const addr = opts.defaultDelivery ?? company?.deliveryAddress ?? company?.billingAddress
  const [delName, setDelName] = useState('')
  const [delLine, setDelLine] = useState('')
  const [delZip, setDelZip] = useState('')
  const [delCity, setDelCity] = useState('')
  const [delCountry, setDelCountry] = useState('')
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (addr && !prefilled) {
      setDelName(addr.name ?? '')
      setDelLine(addr.line1)
      setDelZip(addr.zip)
      setDelCity(addr.city)
      setDelCountry(addr.country ?? '')
      setPrefilled(true)
    }
  }, [addr, prefilled])

  const activeRows = rows.filter((r) => r.quantity > 0)
  const net = useMemo(() => activeRows.reduce((s, r) => s + r.unitPrice * r.quantity, 0), [activeRows])
  const shipping = shippingFor(net)
  const vat = vatFrom(net + shipping)
  const gross = grossFrom(net + shipping)
  const totalQty = activeRows.reduce((s, r) => s + r.quantity, 0)
  // create_order confirms a reorder price only for at least the quantity it
  // was confirmed for; less (or no price yet) → the back office confirms it.
  // Rows keep their index (removing sets quantity 0), so lines[i] is the source.
  const isProvisional = (r: CartLine, i: number) =>
    !readOnly && r.quantity > 0 && (r.unitPrice <= 0 || r.quantity < (lines[i]?.quantity ?? 0))
  const hasOpenPrices = rows.some(isProvisional)

  function setQty(idx: number, q: number) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, quantity: Math.max(0, Math.min(100000, Math.floor(q))) } : r)))
  }
  function setLineField(idx: number, patch: Partial<CartLine>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const place = useMutation({
    mutationFn: (meta: OrderMeta) => (quote ? acceptQuote(quote.id, meta) : createOrder(activeRows, meta)),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (quote) queryClient.invalidateQueries({ queryKey: ['quotes'] })
      opts.onPlaced?.(order)
      onClose()
      navigate(`/bestellung-erfolg/${order.id}`)
    },
    // e.g. the quote expired meanwhile → refresh the list behind the dialog
    onError: () => {
      if (quote) queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })

  function submit() {
    setFormError('')
    if (!delLine.trim() || !delZip.trim() || !delCity.trim()) {
      return setFormError('Bitte die Lieferadresse vollständig angeben (Straße, PLZ und Ort).')
    }
    if (deliveryDate && deliveryDate < today) {
      return setFormError('Der Wunschtermin darf nicht in der Vergangenheit liegen.')
    }
    place.mutate({
      poNumber,
      requestedDate: deliveryDate || undefined,
      note,
      deliveryAddress: { name: delName, line1: delLine, zip: delZip, city: delCity, country: delCountry },
    })
  }

  // Esc closes the dialog (not while the order is being sent).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !place.isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, place.isPending])

  const submitLabel = quote ? 'Angebot verbindlich annehmen' : (opts.submitLabel ?? 'Verbindlich bestellen')

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !place.isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-confirm-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="order-confirm-title" className="font-semibold tracking-tight">
              {quote ? `Angebot ${quote.quoteNumber} annehmen` : (opts.title ?? 'Bestellung prüfen & absenden')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {quote
                ? `${quote.title}${quote.validUntil ? ` · gültig bis ${formatDate(quote.validUntil)}` : ''}`
                : 'Menge, Rechnungs- und Lieferdaten bestätigen.'}
            </p>
          </div>
          <button onClick={onClose} disabled={place.isPending} className="text-muted-foreground hover:text-foreground" aria-label="Schließen">
            <X className="size-5" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Positions */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {readOnly ? 'Positionen laut Angebot' : 'Positionen & Mengen'}
            </h3>
            <div className="mt-2 divide-y divide-border rounded-lg border border-border">
              {rows.map((r, i) => {
                const priced = r.unitPrice > 0 || readOnly
                const provisional = priced && isProvisional(r, i)
                return (
                  <div key={i} className={r.quantity === 0 ? 'p-3 opacity-50' : 'p-3'}>
                    <div className="flex items-center gap-3">
                      <img src={r.imageUrl || ITEM_PLACEHOLDER} alt="" className="size-11 rounded-md border border-border object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.color} · Größe {r.size} ·{' '}
                          {priced ? formatEUR(r.unitPrice) : <span className="text-amber-700">Preis wird bestätigt</span>}
                          {provisional && <span className="text-amber-700"> (vorläufig – geringere Menge als zuletzt)</span>}
                        </p>
                      </div>
                      {readOnly ? (
                        <span className="text-sm text-muted-foreground">{r.quantity} Stück</span>
                      ) : (
                        <div className="flex h-8 items-center rounded-lg border border-input">
                          <button onClick={() => setQty(i, r.quantity - 1)} className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Weniger">
                            <Minus className="size-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={r.quantity}
                            aria-label={`Menge ${r.productName}`}
                            onChange={(e) => setQty(i, Number(e.target.value) || 0)}
                            className="h-8 w-14 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button onClick={() => setQty(i, r.quantity + 1)} className="grid size-8 place-items-center text-muted-foreground hover:text-foreground" aria-label="Mehr">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      )}
                      <span className="w-20 text-right text-sm font-medium">
                        {priced ? formatEUR(r.unitPrice * r.quantity) : '–'}
                      </span>
                      {!readOnly && (
                        <button onClick={() => setQty(i, 0)} className="text-muted-foreground hover:text-destructive" aria-label="Position entfernen">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    {/* #12 Druck & Veredelung */}
                    {!readOnly && (
                      <div className="mt-2 grid grid-cols-1 gap-2 pl-14 sm:grid-cols-2">
                        <input
                          value={r.printPosition ?? ''}
                          onChange={(e) => setLineField(i, { printPosition: e.target.value })}
                          placeholder="Druckposition (z. B. Brust links, Rücken)"
                          aria-label="Druckposition"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:border-ring focus:outline-none"
                        />
                        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-input px-2 text-xs text-muted-foreground hover:bg-muted">
                          <Paperclip className="size-3.5" />
                          <span className="truncate">{r.artworkName ?? 'Druckdatei anhängen'}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept={ARTWORK_ACCEPT}
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              e.target.value = ''
                              if (!f) return
                              const problem = artworkProblem(f)
                              if (problem) { alert(problem); return }
                              setLineField(i, { artworkName: f.name, artworkFile: f, artworkPath: undefined })
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {hasOpenPrices && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Für mindestens eine Position liegt noch kein bestätigter Preis vor (neuer Artikel oder
                geringere Menge als zuletzt). Sie können trotzdem bestellen – das Ballina-Team bestätigt
                den Preis vor der Produktion und informiert Sie.
              </p>
            )}
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
          <section className="grid gap-4 sm:grid-cols-6">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:col-span-6">
              Lieferung
            </h3>
            <div className="sm:col-span-6">
              <Label htmlFor="del-name">Empfänger / Abteilung (optional)</Label>
              <Input id="del-name" value={delName} onChange={(e) => setDelName(e.target.value)} placeholder="z. B. Lager, z. Hd. Frau Muster" />
            </div>
            <div className="sm:col-span-6">
              <Label htmlFor="del-line">Straße und Hausnummer *</Label>
              <Input id="del-line" value={delLine} onChange={(e) => setDelLine(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="del-zip">PLZ *</Label>
              <Input id="del-zip" value={delZip} onChange={(e) => setDelZip(e.target.value)} autoComplete="postal-code" required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="del-city">Ort *</Label>
              <Input id="del-city" value={delCity} onChange={(e) => setDelCity(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="del-country">Land</Label>
              <Input id="del-country" value={delCountry} onChange={(e) => setDelCountry(e.target.value)} placeholder="Deutschland" />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="po">Bestellzeichen / Kostenstelle (optional)</Label>
              <Input id="po" value={poNumber} maxLength={100} onChange={(e) => setPoNumber(e.target.value)} placeholder="z. B. PO-2026-114" />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="dd">Wunschtermin (optional)</Label>
              <Input id="dd" type="date" min={today} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="sm:col-span-6">
              <Label htmlFor="note">Anmerkung (optional)</Label>
              <Textarea id="note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Druckposition, Konfektionierung, Anlieferzeiten…" />
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
              <span>Versand netto {shipping === 0 ? '' : `(frei ab ${formatEUR(FREE_SHIPPING_FROM)})`}</span>
              <span>{shipping === 0 ? 'kostenlos' : formatEUR(shipping)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>zzgl. {Math.round(VAT_RATE * 100)} % USt.</span>
              <span>{formatEUR(vat)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>Gesamt (brutto){hasOpenPrices ? ' – vorläufig' : ''}</span>
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
              onClick={submit}
              disabled={place.isPending || totalQty === 0}
            >
              {place.isPending && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
          {(formError || place.isError) && (
            <p role="alert" className="mt-2 text-center text-xs text-destructive">
              {formError || `${quote ? 'Annahme' : 'Bestellung'} fehlgeschlagen: ${(place.error as Error)?.message || 'Bitte erneut versuchen.'}`}
            </p>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {quote
              ? 'Mit der Annahme bestellen Sie die Positionen des Angebots verbindlich zu den angegebenen Preisen (zzgl. Versand und USt.). Solange die Bestellung offen ist, können Sie sie noch stornieren.'
              : 'Verbindlich sind Ihre hinterlegten Konditionen. Neue Artikel oder geänderte Mengen werden vom Ballina-Team preislich bestätigt.'}
          </p>
        </div>
      </div>
    </div>
  )
}
