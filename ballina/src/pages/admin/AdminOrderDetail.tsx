import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Download, FileText, Loader2, Printer, RefreshCw } from 'lucide-react'
import {
  adminAttachInvoice,
  adminConfirmOrderPrices,
  adminGetCustomer,
  adminGetOrder,
  adminSetReclamationStatus,
  adminUpdateOrder,
  isHttpsUrl,
} from '@/lib/adminApi'
import { invoiceHref } from '@/lib/invoices'
import { openDeliveryNote } from '@/lib/documents'
import { formatDate, formatEUR, grossFrom, ITEM_PLACEHOLDER, NEXT_STATUS } from '@/lib/utils'
import {
  ORDER_STATUS_LABELS,
  RECLAMATION_STATUS_LABELS,
  type OrderStatus,
  type ReclamationStatus,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Input, Label, Textarea } from '@/components/ui/input'
import { OrderTimeline } from '@/components/OrderTimeline'
import { ArtworkLink } from '@/components/ArtworkLink'
import { InternalNotes } from './InternalNotes'
import { formatDecimal, formatQty, parseDecimal, readPdfFile } from './adminFormat'

const STATUSES: OrderStatus[] = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert']
const RECLAMATION_STATUSES: ReclamationStatus[] = ['offen', 'in_bearbeitung', 'erledigt']

export default function AdminOrderDetail() {
  const { id = '' } = useParams()
  const location = useLocation()
  // Set by "Neue Bestellung" when the order was created but the PDF / tracking data failed.
  const createState = location.state as { invoiceError?: string; trackingError?: string } | null
  const createInvoiceError = createState?.invoiceError
  const createTrackingError = createState?.trackingError
  const queryClient = useQueryClient()
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => adminGetOrder(id),
  })
  // Customer master data for the delivery note (loaded up front so the print
  // window opens directly from the click – popup blockers).
  const companyId = order?.companyId ?? ''
  const { data: customer } = useQuery({
    queryKey: ['admin', 'customer', companyId],
    queryFn: () => adminGetCustomer(companyId),
    enabled: !!companyId,
  })

  const [status, setStatus] = useState<OrderStatus>('offen')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  // Provisional prices (customer order without a confirmed price source).
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [reclStatus, setReclStatus] = useState<ReclamationStatus>('offen')
  const [reclNote, setReclNote] = useState('')

  useEffect(() => {
    if (order) {
      setStatus(order.status)
      setCarrier(order.trackingCarrier ?? '')
      setTrackingNumber(order.trackingNumber ?? '')
      setTrackingUrl(order.trackingUrl ?? '')
      setPrices(Object.fromEntries(order.items.map((it) => [it.id, formatDecimal(it.unitPrice)])))
      setReclStatus(order.reclamationStatus ?? 'offen')
    }
  }, [order])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
  }

  const confirmPrices = useMutation({
    mutationFn: () => {
      const parsed: Record<string, number> = {}
      for (const [itemId, raw] of Object.entries(prices)) {
        const n = parseDecimal(raw)
        if (!Number.isFinite(n) || n < 0 || n > 100000) throw new Error('Bitte gültige Preise eingeben (z. B. 12,50).')
        parsed[itemId] = Math.round(n * 100) / 100
      }
      return adminConfirmOrderPrices(id, parsed)
    },
    onSuccess: invalidate,
  })

  const urlInvalid = !!trackingUrl.trim() && !isHttpsUrl(trackingUrl.trim())
  const statusChanged = !!order && status !== order.status
  // New carrier / tracking number on an order that already is 'versendet' →
  // short "Sendungsverfolgung aktualisiert" mail (see adminUpdateOrder).
  const trackingChanged =
    !!order &&
    order.status === 'versendet' &&
    !statusChanged &&
    !!trackingNumber.trim() &&
    (carrier.trim() !== (order.trackingCarrier ?? '') || trackingNumber.trim() !== (order.trackingNumber ?? ''))

  const save = useMutation({
    mutationFn: () =>
      adminUpdateOrder(id, {
        // Only a real status change triggers the customer mail (shipped/cancelled).
        status: statusChanged ? status : undefined,
        trackingCarrier: carrier,
        trackingNumber,
        trackingUrl: trackingUrl.trim(),
      }),
    onSuccess: () => {
      invalidate()
      setSaved(
        statusChanged && (status === 'versendet' || status === 'storniert')
          ? 'Gespeichert – der Kunde wird per E-Mail informiert.'
          : trackingChanged
            ? 'Gespeichert – der Kunde erhält die neuen Sendungsdaten per E-Mail (sofern ihm der Versand bereits per E-Mail gemeldet wurde).'
            : 'Gespeichert',
      )
      setTimeout(() => setSaved(null), 5000)
    },
  })

  const reclamation = useMutation({
    mutationFn: () => adminSetReclamationStatus(id, reclStatus, reclNote),
    onSuccess: () => {
      setReclNote('')
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['admin', 'notes', `o:${id}`] })
    },
  })

  const attach = useMutation({
    mutationFn: async (file: File) => {
      const { name, dataUrl } = await readPdfFile(file)
      return adminAttachInvoice(id, name, dataUrl)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] })
    },
  })

  const download = useMutation({
    mutationFn: async () => {
      if (!order?.invoiceDataUrl) throw new Error('Kein Dokument gespeichert.')
      // Open the tab synchronously (popup blockers), then point it at the signed URL.
      const win = window.open('', '_blank')
      try {
        let href = await invoiceHref(order.invoiceDataUrl)
        // Browsers refuse top-level navigation to data: URLs (mock mode) → blob URL.
        if (href.startsWith('data:')) href = URL.createObjectURL(await (await fetch(href)).blob())
        if (win) win.location.href = href
        else window.location.href = href
      } catch (e) {
        win?.close()
        throw e
      }
    },
  })

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again after an error
    if (f) attach.mutate(f)
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (isError) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <p className="font-medium text-destructive">
          Bestellung konnte nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="size-4" /> Erneut versuchen
        </Button>
      </Card>
    )
  }
  if (!order) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <p className="font-medium">Bestellung nicht gefunden</p>
        <Link to="/admin/bestellungen">
          <Button variant="outline">Zurück</Button>
        </Link>
      </Card>
    )
  }

  // Same rule as list badge / KPI: a cancelled order needs no price confirmation.
  const pricesPending = order.priceConfirmed === false && order.status !== 'storniert'
  const hasDetails = !!(order.poNumber || order.requestedDate || order.deliveryAddress)

  return (
    <div>
      <Link
        to="/admin/bestellungen"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Alle Bestellungen
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">#{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        {pricesPending && <Badge variant="warning">Preise unbestätigt</Badge>}
        {order.reclamation && (
          <Badge variant={order.reclamationStatus === 'erledigt' ? 'neutral' : 'destructive'}>
            Reklamation: {RECLAMATION_STATUS_LABELS[order.reclamationStatus ?? 'offen']}
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        <Link to={`/admin/kunde/${order.companyId}`} className="hover:text-foreground hover:underline">
          {order.companyName}
        </Link>{' '}
        · bestellt am {formatDate(order.createdAt)} · {formatEUR(order.total)} netto
      </p>

      {createInvoiceError && !order.invoiceName && (
        <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Die Bestellung wurde angelegt, das PDF konnte aber nicht gespeichert werden ({createInvoiceError}).
          Bitte unten unter „Dokument“ erneut anhängen.
        </div>
      )}
      {createTrackingError && !order.trackingNumber && !order.trackingCarrier && (
        <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Die Bestellung wurde angelegt, die Sendungsdaten konnten aber nicht gespeichert werden ({createTrackingError}).
          Bitte rechts erneut eintragen und speichern – der Kunde erhält dann die neuen Sendungsdaten per E-Mail.
        </div>
      )}

      {/* Reklamation vom Kunden – mit Bearbeitungsstatus. */}
      {order.reclamation && (
        <Card className="mt-5 border-destructive/30 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" /> Reklamation vom Kunden
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{order.reclamation}</p>
          {order.reclamationResolvedAt && (
            <p className="mt-1 text-xs text-muted-foreground">Erledigt am {formatDate(order.reclamationResolvedAt)}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {RECLAMATION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReclStatus(s)}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (reclStatus === s ? 'border-brand bg-brand-muted text-brand' : 'border-border text-muted-foreground hover:bg-muted')
                }
              >
                {RECLAMATION_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <Textarea
            className="mt-3"
            value={reclNote}
            onChange={(e) => setReclNote(e.target.value)}
            placeholder="Interne Notiz zur Reklamation (optional, nur Backoffice) – z. B. Ersatz in Produktion, Gutschrift erstellt…"
            maxLength={4000}
            aria-label="Interne Notiz zur Reklamation"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reclamation.mutate()}
              disabled={reclamation.isPending || (reclStatus === (order.reclamationStatus ?? 'offen') && !reclNote.trim())}
            >
              {reclamation.isPending && <Loader2 className="size-4 animate-spin" />}
              Reklamation aktualisieren
            </Button>
            {reclamation.isError && (
              <span role="alert" className="text-sm text-destructive">{(reclamation.error as Error).message}</span>
            )}
            {reclamation.isSuccess && !reclamation.isPending && (
              <span className="text-sm text-muted-foreground">Gespeichert.</span>
            )}
          </div>
        </Card>
      )}

      {pricesPending && (
        <Card className="mt-5 border-amber-300 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-amber-600" /> Preise unbestätigt
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Diese Kundenbestellung enthält Artikel ohne bestätigten Preis (neuer Artikel, andere
            Variante oder kleinere Menge als zuvor). Netto-Einzelpreise prüfen und bestätigen – erst
            dann kann die Bestellung versendet werden. Der Kunde erhält danach eine E-Mail mit den
            bestätigten Preisen.
          </p>
          <div className="mt-3 space-y-2">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {it.productName} · {it.color} · {it.size} · {formatQty(it.quantity)}×
                </span>
                <Input
                  className="h-8 w-28 text-right"
                  inputMode="decimal"
                  value={prices[it.id] ?? ''}
                  onChange={(e) => setPrices((p) => ({ ...p, [it.id]: e.target.value }))}
                  aria-label={`Einzelpreis ${it.productName}`}
                />
                <span className="text-xs text-muted-foreground">€</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="brand" size="sm" onClick={() => confirmPrices.mutate()} disabled={confirmPrices.isPending}>
              {confirmPrices.isPending && <Loader2 className="size-4 animate-spin" />}
              Preise bestätigen
            </Button>
            {confirmPrices.isError && (
              <span role="alert" className="text-sm text-destructive">{(confirmPrices.error as Error).message}</span>
            )}
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {order.items.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <img src={it.imageUrl || ITEM_PLACEHOLDER} alt="" className="size-12 rounded-md border border-border object-cover" />
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-medium">{it.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {[it.color, it.size ? `Größe ${it.size}` : '', it.printPosition ? `Druck: ${it.printPosition}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {it.artworkPath ? (
                      <ArtworkLink path={it.artworkPath} name={it.artworkName} />
                    ) : it.artworkName ? (
                      <p className="text-xs text-muted-foreground">Datei (nicht hochgeladen): {it.artworkName}</p>
                    ) : null}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatQty(it.quantity)} × {formatEUR(it.unitPrice)}
                  </span>
                  <span className="w-24 text-right font-medium">
                    {formatEUR(it.unitPrice * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-muted/30 px-5 py-3 text-right text-sm">
              Warenwert (netto): <span className="font-semibold">{formatEUR(order.total)}</span>
              {' · '}Versand: <span className="font-semibold">{order.shipping ? formatEUR(order.shipping) : 'kostenlos'}</span>
              {' · '}Gesamt (brutto):{' '}
              <span className="font-semibold">{formatEUR(grossFrom(order.total + (order.shipping ?? 0)))}</span>
            </div>
          </Card>

          {/* Structured order details from the portal (012). */}
          {hasDetails && (
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bestelldetails</p>
              <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Bestellzeichen</dt>
                  <dd className="font-medium">{order.poNumber || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Wunschtermin</dt>
                  <dd className="font-medium">{order.requestedDate ? formatDate(order.requestedDate) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Lieferadresse</dt>
                  <dd className="font-medium">
                    {order.deliveryAddress ? (
                      <>
                        {order.deliveryAddress.name && <span className="block">{order.deliveryAddress.name}</span>}
                        <span className="block">{order.deliveryAddress.line1}</span>
                        <span className="block">
                          {order.deliveryAddress.zip} {order.deliveryAddress.city}
                          {order.deliveryAddress.country ? `, ${order.deliveryAddress.country}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="font-normal text-muted-foreground">Standardadresse des Kunden</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          {order.note && (
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Anmerkung (für den Kunden sichtbar)
              </p>
              <p className="mt-1.5 whitespace-pre-line text-sm">{order.note}</p>
            </Card>
          )}

          <InternalNotes target={{ orderId: order.id }} />
        </div>

        {/* Editor */}
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const transition = s === order.status || (NEXT_STATUS[order.status] ?? []).includes(s)
                const blockedByPrices = pricesPending && s !== order.status && (s === 'versendet' || s === 'abgeschlossen')
                const allowed = transition && !blockedByPrices
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    disabled={!allowed}
                    title={
                      blockedByPrices && transition
                        ? 'Erst die Preise bestätigen'
                        : allowed
                          ? undefined
                          : 'Dieser Statuswechsel ist nicht möglich'
                    }
                    className={
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ' +
                      (status === s
                        ? 'border-brand bg-brand-muted text-brand'
                        : 'border-border text-muted-foreground hover:bg-muted')
                    }
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </button>
                )
              })}
            </div>
            {pricesPending && (
              <p className="mt-2 text-xs text-amber-700">„Versendet“ ist erst nach der Preisbestätigung möglich.</p>
            )}

            <div className="mt-5 space-y-3">
              <div>
                <Label htmlFor="carrier">Versanddienst</Label>
                <Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="z. B. DHL" />
              </div>
              <div>
                <Label htmlFor="tn">Sendungsnummer</Label>
                <Input id="tn" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking-Nr." />
              </div>
              <div>
                <Label htmlFor="tu">Tracking-Link</Label>
                <Input
                  id="tu"
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://…"
                  aria-invalid={urlInvalid || undefined}
                />
                {urlInvalid && (
                  <p className="mt-1 text-xs text-destructive">Bitte einen vollständigen https-Link eingeben.</p>
                )}
              </div>
            </div>

            <Button
              variant="brand"
              className="mt-5 w-full"
              onClick={() => save.mutate()}
              disabled={save.isPending || urlInvalid}
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : null}
              {saved ? 'Gespeichert' : 'Änderungen speichern'}
            </Button>
            {saved && <p className="mt-2 text-center text-xs text-muted-foreground">{saved}</p>}
            {save.error && (
              <p role="alert" className="mt-2 text-center text-xs text-destructive">
                {save.error instanceof Error ? save.error.message : 'Speichern fehlgeschlagen.'}
              </p>
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Statuswechsel wird dem Kunden im Verlauf angezeigt; beim Wechsel auf „Versendet“ oder
              „Storniert“ erhält er einmalig eine E-Mail. Ändern Sie danach Versanddienst oder
              Sendungsnummer, erhält er eine kurze E-Mail mit den neuen Sendungsdaten.
            </p>
          </Card>

          {/* Delivery note (printable, without prices) */}
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lieferschein</p>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => customer && openDeliveryNote(order, customer)}
              disabled={!customer || order.status === 'storniert'}
            >
              <Printer className="size-4" /> Lieferschein drucken
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Ohne Preise – mit Lieferadresse, Bestellzeichen und Positionen. Öffnet den Druckdialog
              (dort „Als PDF speichern“ wählen).
            </p>
          </Card>

          {/* Invoice PDF */}
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dokument</p>
            {order.invoiceName ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                  <FileText className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 truncate">{order.invoiceName}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => download.mutate()}
                    disabled={download.isPending || !order.invoiceDataUrl}
                  >
                    <Download className="size-4" /> Download
                  </Button>
                  <label
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-input px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted"
                    title="Dokument ersetzen"
                  >
                    {attach.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Ersetzen
                    <input type="file" accept="application/pdf" className="hidden" onChange={onPick} disabled={attach.isPending} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:bg-muted">
                {attach.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                Dokument (PDF) anhängen
                <input type="file" accept="application/pdf" className="hidden" onChange={onPick} disabled={attach.isPending} />
              </label>
            )}
            {attach.isError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                Dokument nicht gespeichert: {(attach.error as Error).message}
              </p>
            )}
            {download.isError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                Download fehlgeschlagen: {(download.error as Error).message}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">PDF, max. 4 MB. Der Kunde kann das Dokument dann im Portal herunterladen.</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verlauf</p>
            <div className="mt-4">
              <OrderTimeline order={order} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
