import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { adminGetCustomer, adminUpdateCustomer } from '@/lib/adminApi'
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

  const [discount, setDiscount] = useState('')
  const [budget, setBudget] = useState('')
  const [terms, setTerms] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (customer) {
      setDiscount(String(customer.discountPercent ?? 0))
      setBudget(customer.annualBudget != null ? String(customer.annualBudget) : '')
      setTerms(customer.paymentTerms ?? '')
      setContact(customer.contactPerson ?? '')
      setPhone(customer.phone ?? '')
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
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? 'Gespeichert' : 'Konditionen speichern'}
        </Button>
        <Link to={`/admin/angebote/neu?kunde=${customer.id}`}>
          <Button variant="outline">Angebot für diesen Kunden</Button>
        </Link>
      </div>
    </div>
  )
}
