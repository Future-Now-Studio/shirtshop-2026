import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { formatEUR } from '@/lib/utils'
import { createInquiry } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'

export default function Inquiry({ embedded = false }: { embedded?: boolean }) {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [productType, setProductType] = useState('')
  const [quantity, setQuantity] = useState('')
  const [deadline, setDeadline] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createInquiry({
        productType,
        quantity: Number(quantity) || 0,
        deadline: deadline || undefined,
        message: message || undefined,
      })
      setSent(true)
      setProductType('')
      setQuantity('')
      setDeadline('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anfrage fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div>
        {!embedded && <PageHeader title="Großanfrage" />}
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-success/12 text-success">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <p className="text-lg font-semibold">Anfrage gesendet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Danke! Wir erstellen Ihnen ein individuelles Angebot und melden uns kurzfristig.
            </p>
          </div>
          <Button variant="outline" onClick={() => setSent(false)}>
            Weitere Anfrage
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Großanfrage"
          description="Individuelle Mengen, Sonderartikel oder Sonderkonditionen? Fordern Sie ein Angebot an."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pt">Produkt / Artikel *</Label>
              <Input
                id="pt"
                placeholder="z. B. T-Shirts mit Rückenprint"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qty">Menge *</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  placeholder="z. B. 250"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dl">Wunschtermin</Label>
                <Input
                  id="dl"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg">Details</Label>
              <Textarea
                id="msg"
                className="min-h-32"
                placeholder="Beschreiben Sie Größen, Farben, Druck-/Stickdetails…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" variant="brand" size="xl" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Wird gesendet…' : 'Anfrage senden'}
            </Button>
          </form>
        </Card>

        <Card className="h-fit bg-muted/40 p-5">
          <h3 className="font-semibold tracking-tight">Ihre Vorteile</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              Staffelpreise ab {formatEUR(9.9)} pro Stück
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              Persönlicher Ansprechpartner
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              Angebot innerhalb von 24 h
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
