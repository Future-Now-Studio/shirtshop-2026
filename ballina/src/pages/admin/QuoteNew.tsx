import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { adminCreateQuote, adminGetInquiries } from '@/lib/adminApi'
import { formatEUR } from '@/lib/utils'
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

export default function QuoteNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { data: inquiries = [] } = useQuery({ queryKey: ['admin', 'inquiries'], queryFn: adminGetInquiries })

  const [companyId, setCompanyId] = useState('')
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }])

  // Prefill from ?kunde= or ?anfrage=
  useEffect(() => {
    const kunde = params.get('kunde')
    const anfrage = params.get('anfrage')
    if (anfrage) {
      const inq = inquiries.find((i) => i.id === anfrage)
      if (inq) {
        setCompanyId(inq.companyId)
        setTitle(inq.productType)
        setRows([{ productName: inq.productType, color: '', size: '', quantity: inq.quantity, unitPrice: 0 }])
      }
    } else if (kunde) {
      setCompanyId(kunde)
    }
  }, [params, inquiries])

  const total = rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0)

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const create = useMutation({
    mutationFn: () =>
      adminCreateQuote({
        companyId,
        title,
        validUntil: validUntil ? new Date(validUntil).toISOString() : new Date(Date.now() + 30 * 864e5).toISOString(),
        note: note || undefined,
        items: rows
          .filter((r) => r.productName && r.quantity > 0)
          .map((r) => ({ productId: 'custom', imageUrl: '', ...r })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'quotes'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      navigate('/admin/angebote')
    },
  })

  const valid = companyId && title && rows.some((r) => r.productName && r.quantity > 0 && r.unitPrice >= 0)

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zurück
      </button>
      <PageHeader title="Neues Angebot" description="Angebot für einen Kunden zusammenstellen und senden." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Positions */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Positionen</h3>
            <div className="mt-3 space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-4">
                    {i === 0 && <Label>Artikel</Label>}
                    <Input value={r.productName} onChange={(e) => setRow(i, { productName: e.target.value })} placeholder="z. B. Softshell-Jacke" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    {i === 0 && <Label>Farbe</Label>}
                    <Input value={r.color} onChange={(e) => setRow(i, { color: e.target.value })} placeholder="Schwarz" />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    {i === 0 && <Label>Größe</Label>}
                    <Input value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} placeholder="L" />
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
                    <button
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))}
                      className="grid size-9 place-items-center text-muted-foreground hover:text-destructive"
                      aria-label="Position entfernen"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}>
              <Plus className="size-4" />
              Position hinzufügen
            </Button>
          </Card>

          <Card className="p-5">
            <Label htmlFor="note">Hinweis zum Angebot (optional)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Staffelpreise, Druckkosten, Lieferzeit…" />
          </Card>
        </div>

        {/* Meta / submit */}
        <Card className="h-fit space-y-4 p-5">
          <CustomerCombobox value={companyId} onChange={setCompanyId} />
          <div>
            <Label htmlFor="title">Titel</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Winterjacken 2026" />
          </div>
          <div>
            <Label htmlFor="valid">Gültig bis</Label>
            <Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>

          <div className="flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Angebotssumme</span>
            <span className="font-semibold">{formatEUR(total)}</span>
          </div>

          <Button variant="brand" className="w-full" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Angebot senden
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Der Kunde sieht das Angebot sofort in seinem Portal.
          </p>
        </Card>
      </div>
    </div>
  )
}
