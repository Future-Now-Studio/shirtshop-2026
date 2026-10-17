import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { adminGetBudgetSpent, adminGetCustomer, adminUpdateCustomer } from '@/lib/adminApi'
import { berlinYear } from '@/lib/utils'
import { BudgetBar } from '@/components/BudgetBar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'

export default function AdminCustomerDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: customer, isLoading } = useQuery({
    queryKey: ['admin', 'customer', id],
    queryFn: () => adminGetCustomer(id),
  })
  const year = berlinYear()
  const hasBudget = (customer?.annualBudget ?? 0) > 0
  const { data: spent } = useQuery({
    queryKey: ['admin', 'customer', id, 'budget', year],
    queryFn: () => adminGetBudgetSpent(id, year),
    enabled: hasBudget,
  })

  const [discount, setDiscount] = useState('')
  const [budget, setBudget] = useState('')
  const [terms, setTerms] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [vatId, setVatId] = useState('')
  const [bLine, setBLine] = useState('')
  const [bZip, setBZip] = useState('')
  const [bCity, setBCity] = useState('')
  const [dLine, setDLine] = useState('')
  const [dZip, setDZip] = useState('')
  const [dCity, setDCity] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (customer) {
      setDiscount(String(customer.discountPercent ?? 0))
      setBudget(customer.annualBudget != null ? String(customer.annualBudget) : '')
      setTerms(customer.paymentTerms ?? '')
      setContact(customer.contactPerson ?? '')
      setPhone(customer.phone ?? '')
      setVatId(customer.vatId ?? '')
      setBLine(customer.billingAddress?.line1 ?? '')
      setBZip(customer.billingAddress?.zip ?? '')
      setBCity(customer.billingAddress?.city ?? '')
      setDLine(customer.deliveryAddress?.line1 ?? '')
      setDZip(customer.deliveryAddress?.zip ?? '')
      setDCity(customer.deliveryAddress?.city ?? '')
    }
  }, [customer])

  const save = useMutation({
    mutationFn: () =>
      adminUpdateCustomer(id, {
        discountPercent: Number(discount) || 0,
        annualBudget: budget ? Number(budget) : undefined,
        paymentTerms: terms || undefined,
        contactPerson: contact,
        phone: phone || undefined,
        vatId,
        billingAddress: bLine ? { line1: bLine, zip: bZip, city: bCity } : undefined,
        deliveryAddress: dLine ? { line1: dLine, zip: dZip, city: dCity } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!customer) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <p className="font-medium">Kunde nicht gefunden</p>
        <Link to="/admin/kunden">
          <Button variant="outline">Zurück</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div>
      <Link to="/admin/kunden" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Kunden
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">{customer.company}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Kd-Nr. {customer.customerNumber}
        {customer.billingAddress ? ` · ${customer.billingAddress.line1}, ${customer.billingAddress.zip} ${customer.billingAddress.city}` : ''}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Konditionen</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="disc">Rabatt (%)</Label>
              <Input id="disc" type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bud">Jahresbudget (€)</Label>
              <Input id="bud" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            {hasBudget && spent != null && (
              <BudgetBar className="col-span-2" spent={spent} budget={customer.annualBudget!} year={year} />
            )}
            <div className="col-span-2">
              <Label htmlFor="terms">Zahlungsziel</Label>
              <Input id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="z. B. 30 Tage netto" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">Ansprechpartner</h3>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="contact">Name</Label>
              <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">E-Mail: {customer.email}</p>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Adressen &amp; Steuer</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Erscheint beim Kunden unter „Rechnung an“ und als Standard-Lieferadresse.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rechnungsadresse</p>
              <Input aria-label="Rechnungsadresse Straße" placeholder="Straße und Hausnummer" value={bLine} onChange={(e) => setBLine(e.target.value)} />
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <Input aria-label="Rechnungsadresse PLZ" placeholder="PLZ" value={bZip} onChange={(e) => setBZip(e.target.value)} />
                <Input aria-label="Rechnungsadresse Ort" placeholder="Ort" value={bCity} onChange={(e) => setBCity(e.target.value)} />
              </div>
              <Label htmlFor="vatid">USt-IdNr.</Label>
              <Input id="vatid" placeholder="DE 123 456 789" value={vatId} onChange={(e) => setVatId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lieferadresse (optional)</p>
              <Input aria-label="Lieferadresse Straße" placeholder="Straße und Hausnummer" value={dLine} onChange={(e) => setDLine(e.target.value)} />
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <Input aria-label="Lieferadresse PLZ" placeholder="PLZ" value={dZip} onChange={(e) => setDZip(e.target.value)} />
                <Input aria-label="Lieferadresse Ort" placeholder="Ort" value={dCity} onChange={(e) => setDCity(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? 'Gespeichert' : 'Kundendaten speichern'}
        </Button>
        {save.error && (
          <span role="alert" className="text-sm text-destructive">
            {save.error instanceof Error ? save.error.message : 'Speichern fehlgeschlagen.'}
          </span>
        )}
        <Link to={`/admin/angebote/neu?kunde=${customer.id}`}>
          <Button variant="outline">Angebot für diesen Kunden</Button>
        </Link>
      </div>
    </div>
  )
}
