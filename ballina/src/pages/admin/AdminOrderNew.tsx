import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText, Loader2, Lock, X } from 'lucide-react'
import { adminCreateManualOrder, isHttpsUrl } from '@/lib/adminApi'
import { formatEUR } from '@/lib/utils'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'
import { CustomerCombobox } from '@/components/CustomerCombobox'
import { readPdfFile } from './adminFormat'
import { emptyPositionRow, PositionsEditor, summarizePositions, ZeroPriceConfirm, type PositionRow } from './PositionsEditor'

const STATUSES: OrderStatus[] = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen']

export default function AdminOrderNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [companyId, setCompanyId] = useState('')
  const [status, setStatus] = useState<OrderStatus>('offen')
  const [note, setNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [rows, setRows] = useState<PositionRow[]>([{ ...emptyPositionRow }])
  const [invoiceName, setInvoiceName] = useState('')
  const [invoiceDataUrl, setInvoiceDataUrl] = useState('')
  const [invoiceError, setInvoiceError] = useState('')
  const [allowZero, setAllowZero] = useState(false)
  const [notify, setNotify] = useState(true)
  // Shipping data – only for status "Versendet" (same fields as the order detail).
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const shipped = status === 'versendet'
  const urlInvalid = shipped && !!trackingUrl.trim() && !isHttpsUrl(trackingUrl.trim())

  const { items, invalidRows, zeroRows, total } = summarizePositions(rows)

  async function onInvoice(file: File | undefined) {
    if (!file) return
    setInvoiceError('')
    try {
      const { name, dataUrl } = await readPdfFile(file)
      setInvoiceDataUrl(dataUrl)
      setInvoiceName(name)
    } catch (e) {
      setInvoiceError((e as Error).message)
    }
  }

  const create = useMutation({
    mutationFn: () =>
      adminCreateManualOrder({
        companyId,
        status,
        note: note.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        items: items.map((it) => ({ productId: 'manual', imageUrl: '', ...it })),
        allowZeroPrice: zeroRows > 0 && allowZero,
        notifyCustomer: notify,
        ...(shipped ? { trackingCarrier: carrier, trackingNumber, trackingUrl } : {}),
        invoiceName: invoiceName || undefined,
        invoiceDataUrl: invoiceDataUrl || undefined,
      }),
    onSuccess: ({ order, invoiceError: pdfError, trackingError }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      navigate(`/admin/bestellung/${order.id}`, {
        state: pdfError || trackingError ? { invoiceError: pdfError, trackingError } : undefined,
      })
    },
  })

  const valid = !!companyId && items.length > 0 && invalidRows === 0 && (zeroRows === 0 || allowZero) && !urlInvalid

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück
      </button>
      <PageHeader title="Neue Bestellung" description="Manuell einen Auftrag erfassen und optional ein Dokument (z. B. Rechnung) als PDF anhängen." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Positionen</h3>
            <PositionsEditor rows={rows} onChange={setRows} placeholders={{ productName: 'z. B. Poloshirt' }} />
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <Label htmlFor="note">Anmerkung für den Kunden</Label>
              <p className="mb-1 text-xs text-muted-foreground">Erscheint in der Bestellung im Kundenportal.</p>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Lieferung in KW 12, Druck wie Muster vom 03.03." maxLength={2000} />
            </div>
            <div>
              <Label htmlFor="internal" className="flex items-center gap-1.5">
                <Lock className="size-3.5" /> Interne Notiz
              </Label>
              <p className="mb-1 text-xs text-muted-foreground">Nur für das Backoffice sichtbar – nie für den Kunden.</p>
              <Textarea id="internal" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Druckhinweise, Absprachen, Zahlungsverhalten…" maxLength={4000} />
            </div>
          </Card>
        </div>

        <Card className="h-fit space-y-4 p-5">
          <CustomerCombobox value={companyId} onChange={setCompanyId} />
          <div>
            <Label>Status</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={
                    'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ' +
                    (status === st ? 'border-brand bg-brand-muted text-brand' : 'border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {ORDER_STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          {shipped && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Sendungsdaten (optional) – stehen in der Versand-Mail und im Portal.</p>
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
                {urlInvalid && <p className="mt-1 text-xs text-destructive">Bitte einen vollständigen https-Link eingeben.</p>}
              </div>
            </div>
          )}

          {/* Invoice PDF */}
          <div>
            <Label>Dokument (PDF, max. 4 MB)</Label>
            {invoiceName ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-brand" />
                  <span className="truncate">{invoiceName}</span>
                </span>
                <button onClick={() => { setInvoiceName(''); setInvoiceDataUrl('') }} className="text-muted-foreground hover:text-destructive" aria-label="Entfernen">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 text-sm text-muted-foreground hover:bg-muted">
                <FileText className="size-4" />
                PDF anhängen
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => { void onInvoice(e.target.files?.[0]); e.target.value = '' }}
                />
              </label>
            )}
            {invoiceError && <p role="alert" className="mt-1 text-xs text-destructive">{invoiceError}</p>}
          </div>

          <div className="flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Summe (netto, zzgl. Versand)</span>
            <span className="font-semibold">{formatEUR(total)}</span>
          </div>

          <ZeroPriceConfirm count={zeroRows} checked={allowZero} onChange={setAllowZero} />

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>
              {shipped
                ? 'Bestellbestätigung und Versand-Mail an den Kunden senden'
                : 'Bestellbestätigung per E-Mail an den Kunden senden'}
            </span>
          </label>

          <Button variant="brand" className="w-full" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Bestellung anlegen
          </Button>
          {create.isError && (
            <p role="alert" className="text-sm text-destructive">
              Bestellung nicht angelegt: {(create.error as Error).message}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
