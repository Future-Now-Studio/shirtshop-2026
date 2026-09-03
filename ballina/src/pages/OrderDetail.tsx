import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Ban, FileText, Loader2, MoreHorizontal, RefreshCw, Truck } from 'lucide-react'
import { cancelOrder, getOrder, reclaimOrder } from '@/lib/api'
import { formatDate, formatEUR, ITEM_PLACEHOLDER } from '@/lib/utils'
import { invoiceHref } from '@/lib/invoices'
import { useReorder } from '@/lib/useReorder'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { OrderTimeline } from '@/components/OrderTimeline'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
  })
  const { quickReorder, isReordering } = useReorder()
  const [reclaimOpen, setReclaimOpen] = useState(false)
  const [reclaimText, setReclaimText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }
  const cancel = useMutation({ mutationFn: () => cancelOrder(id), onSuccess: invalidate })
  const reclaim = useMutation({
    mutationFn: () => reclaimOrder(id, reclaimText),
    onSuccess: () => {
      invalidate()
      setReclaimOpen(false)
    },
  })

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
        <Link to="/bestellungen">
          <Button variant="outline">Zurück zur Übersicht</Button>
        </Link>
      </Card>
    )
  }

  const subtotal = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
  const canCancel = order.status === 'offen' || order.status === 'in_bearbeitung'
  const canReclaim =
    (order.status === 'versendet' || order.status === 'abgeschlossen') && !order.reclamation

  return (
    <div>
      <Link
        to="/bestellungen"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Alle Bestellungen
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">#{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Bestellt am {formatDate(order.createdAt)} · {order.items.length} Positionen · {totalQty}{' '}
            Stück
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCancel || canReclaim ? (
            <div className="relative">
              <Button variant="outline" size="lg" onClick={() => setMenuOpen((o) => !o)}>
                <MoreHorizontal className="size-4" />
                Aktionen
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg">
                    {canCancel && (
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          if (confirm('Diese Bestellung wirklich stornieren?')) cancel.mutate()
                        }}
                        disabled={cancel.isPending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                      >
                        <Ban className="size-4" />
                        Bestellung stornieren
                      </button>
                    )}
                    {canReclaim && (
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          setReclaimOpen(true)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <AlertTriangle className="size-4" />
                        Reklamation melden
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <Button
            variant="brand"
            size="lg"
            onClick={() => quickReorder(order)}
            disabled={isReordering}
          >
            {isReordering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Nachbestellen
          </Button>
        </div>
      </div>

      {/* #15 reclamation notice */}
      {order.reclamation && (
        <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4" /> Reklamation gemeldet
          </p>
          <p className="mt-1 text-muted-foreground">{order.reclamation}</p>
        </div>
      )}

      {/* #15 reclamation form (opened from the Aktionen menu) */}
      {reclaimOpen && (
        <Card className="mt-5 max-w-lg p-4">
          <p className="text-sm font-medium">Was ist mit der Lieferung nicht in Ordnung?</p>
          <Textarea
            className="mt-2"
            value={reclaimText}
            onChange={(e) => setReclaimText(e.target.value)}
            placeholder="z. B. 3 Poloshirts Größe L fehlen, Druck verschoben…"
          />
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setReclaimOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={() => reclaim.mutate()}
              disabled={!reclaimText.trim() || reclaim.isPending}
            >
              {reclaim.isPending && <Loader2 className="size-4 animate-spin" />}
              Reklamation absenden
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
      {/* Items */}
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Artikel</span>
          <span className="w-20 text-right">Menge</span>
          <span className="w-24 text-right">Einzelpreis</span>
          <span className="w-24 text-right">Summe</span>
        </div>
        <div className="divide-y divide-border">
          {order.items.map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-3">
                <img
                  src={it.imageUrl || ITEM_PLACEHOLDER}
                  alt={it.productName}
                  className="size-12 rounded-md border border-border object-cover"
                />
                <div>
                  <p className="font-medium">{it.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {it.color} · Größe {it.size}
                  </p>
                  {(it.printPosition || it.artworkName) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {it.printPosition ? `Druck: ${it.printPosition}` : ''}
                      {it.printPosition && it.artworkName ? ' · ' : ''}
                      {it.artworkName ? `Datei: ${it.artworkName}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-sm sm:w-20 sm:text-right">
                <span className="text-muted-foreground sm:hidden">Menge: </span>
                {it.quantity}
              </div>
              <div className="text-sm sm:w-24 sm:text-right">
                <span className="text-muted-foreground sm:hidden">Einzel: </span>
                {formatEUR(it.unitPrice)}
              </div>
              <div className="font-medium sm:w-24 sm:text-right">
                {formatEUR(it.unitPrice * it.quantity)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-5 py-4">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Zwischensumme (netto)</span>
              <span>{formatEUR(subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>Gesamt</span>
              <span>{formatEUR(order.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {order.note && (
        <Card className="mt-4 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Anmerkung
          </p>
          <p className="mt-1.5 text-sm">{order.note}</p>
        </Card>
      )}
      </div>

      {/* Aside: tracking, timeline, documents */}
      <aside className="space-y-6">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status &amp; Verlauf
          </p>
          <div className="mt-4">
            <OrderTimeline order={order} />
          </div>
          {order.trackingNumber && (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                {order.trackingCarrier ?? 'Versand'} · Sendungsnr.
              </p>
              <p className="mt-0.5 break-all font-mono text-xs">{order.trackingNumber}</p>
              {order.trackingUrl && (
                <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                  <Button variant="outline" size="sm" className="w-full">
                    <Truck className="size-4" />
                    Sendung verfolgen
                  </Button>
                </a>
              )}
            </div>
          )}
        </Card>

        {order.invoiceDataUrl && (
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dokumente
            </p>
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={async () => {
                  const href = await invoiceHref(order.invoiceDataUrl!)
                  window.open(href, '_blank')
                }}
              >
                <FileText className="size-4" />
                {order.invoiceName || 'Dokument (PDF)'}
              </Button>
            </div>
          </Card>
        )}
      </aside>
      </div>
    </div>
  )
}
