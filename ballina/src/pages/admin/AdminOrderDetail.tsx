import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Download, FileText, Loader2, X } from 'lucide-react'
import { adminAttachInvoice, adminGetOrder, adminUpdateOrder } from '@/lib/adminApi'
import { invoiceHref } from '@/lib/invoices'
import { formatDate, formatEUR, ITEM_PLACEHOLDER } from '@/lib/utils'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { OrderTimeline } from '@/components/OrderTimeline'

const STATUSES: OrderStatus[] = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert']

export default function AdminOrderDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => adminGetOrder(id),
  })

  const [status, setStatus] = useState<OrderStatus>('offen')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (order) {
      setStatus(order.status)
      setCarrier(order.trackingCarrier ?? '')
      setTrackingNumber(order.trackingNumber ?? '')
      setTrackingUrl(order.trackingUrl ?? '')
    }
  }, [order])

  const save = useMutation({
    mutationFn: () =>
      adminUpdateOrder(id, {
        status,
        trackingCarrier: carrier,
        trackingNumber,
        trackingUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const attach = useMutation({
    mutationFn: (file: File) =>
      new Promise<{ name: string; dataUrl: string }>((resolve, reject) => {
        if (file.size > 4_000_000) return reject(new Error('PDF über 4 MB'))
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) })
        reader.onerror = () => reject(new Error('Lesefehler'))
        reader.readAsDataURL(file)
      }).then(({ name, dataUrl }) => adminAttachInvoice(id, name, dataUrl)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] })
    },
  })

  async function downloadInvoice() {
    if (!order?.invoiceDataUrl) return
    const href = await invoiceHref(order.invoiceDataUrl)
    window.open(href, '_blank')
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
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

  return (
    <div>
      <Link
        to="/admin/bestellungen"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Alle Bestellungen
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">#{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {order.companyName} · bestellt am {formatDate(order.createdAt)} · {formatEUR(order.total)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="divide-y divide-border">
            {order.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-5 py-4">
                <img src={it.imageUrl || ITEM_PLACEHOLDER} alt="" className="size-12 rounded-md border border-border object-cover" />
                <div className="flex-1">
                  <p className="font-medium">{it.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {it.color} · Größe {it.size}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {it.quantity} × {formatEUR(it.unitPrice)}
                </span>
                <span className="w-24 text-right font-medium">
                  {formatEUR(it.unitPrice * it.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-muted/30 px-5 py-3 text-right text-sm">
            Gesamt (netto): <span className="font-semibold">{formatEUR(order.total)}</span>
          </div>
        </Card>

        {/* Editor */}
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ' +
                    (status === s
                      ? 'border-brand bg-brand-muted text-brand'
                      : 'border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {ORDER_STATUS_LABELS[s]}
                </button>
              ))}
            </div>

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
                <Input id="tu" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <Button
              variant="brand"
              className="mt-5 w-full"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : null}
              {saved ? 'Gespeichert' : 'Änderungen speichern'}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Statuswechsel wird dem Kunden im Verlauf angezeigt.
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
                  <Button variant="outline" size="sm" className="flex-1" onClick={downloadInvoice}>
                    <Download className="size-4" /> Download
                  </Button>
                  <label className="grid size-9 cursor-pointer place-items-center rounded-lg border border-input text-muted-foreground hover:bg-muted" title="Ersetzen">
                    <X className="size-4" />
                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) attach.mutate(f) }} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:bg-muted">
                {attach.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                Dokument (PDF) anhängen
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) attach.mutate(f) }} />
              </label>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Der Kunde kann das Dokument dann im Portal herunterladen.</p>
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
