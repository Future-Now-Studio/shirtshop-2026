import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText, Loader2, Plus, Trash2, X } from 'lucide-react'
import { adminCreateManualOrder } from '@/lib/adminApi'
import { formatEUR } from '@/lib/utils'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'
import { CustomerCombobox } from '@/components/CustomerCombobox'

interface Row {
  productName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
}
const emptyRow: Row = { productName: '', color: '', size: '', quantity: 10, unitPrice: 0 }
const STATUSES: OrderStatus[] = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen']

export default function AdminOrderNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [companyId, setCompanyId] = useState('')
  const [status, setStatus] = useState<OrderStatus>('offen')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }])
  const [invoiceName, setInvoiceName] = useState('')
  const [invoiceDataUrl, setInvoiceDataUrl] = useState('')

  const total = rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0)

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function onInvoice(file: File | undefined) {
    if (!file) return
    if (file.size > 4_000_000) {
      alert('Bitte eine PDF-Datei unter 4 MB wählen.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setInvoiceDataUrl(String(reader.result))
      setInvoiceName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const create = useMutation({
    mutationFn: () =>
      adminCreateManualOrder({
        companyId,
        status,
        note: note || undefined,
        items: rows
          .filter((r) => r.productName && r.quantity > 0)
          .map((r) => ({ productId: 'manual', imageUrl: '', ...r })),
        invoiceName: invoiceName || undefined,
        invoiceDataUrl: invoiceDataUrl || undefined,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      navigate(`/admin/bestellung/${order.id}`)
    },
  })

  const valid = companyId && rows.some((r) => r.productName && r.quantity > 0)

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
            <div className="mt-3 space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-4">
                    {i === 0 && <Label>Artikel</Label>}
                    <Input value={r.productName} onChange={(e) => setRow(i, { productName: e.target.value })} placeholder="z. B. Poloshirt" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    {i === 0 && <Label>Farbe</Label>}
                    <Input value={r.color} onChange={(e) => setRow(i, { color: e.target.value })} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    {i === 0 && <Label>Größe</Label>}
                    <Input value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    {i === 0 && <Label>Menge</Label>}
                    <Input type="number" min={1} value={r.quantity} onChange={(e) => setRow(i, { quantity: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    {i === 0 && <Label>€/Stück</Label>}
                    <Input type="number" min={0} step="0.01" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))} className="grid size-9 place-items-center text-muted-foreground hover:text-destructive" aria-label="Position entfernen">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}>
              <Plus className="size-4" /> Position hinzufügen
            </Button>
          </Card>

          <Card className="p-5">
            <Label htmlFor="note">Anmerkung</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interne Notiz, Druckhinweise…" />
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

          {/* Invoice PDF */}
          <div>
            <Label>Dokument (PDF)</Label>
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
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onInvoice(e.target.files?.[0])} />
              </label>
            )}
          </div>

          <div className="flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Summe (netto)</span>
            <span className="font-semibold">{formatEUR(total)}</span>
          </div>

          <Button variant="brand" className="w-full" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Bestellung anlegen
          </Button>
        </Card>
      </div>
    </div>
  )
}
