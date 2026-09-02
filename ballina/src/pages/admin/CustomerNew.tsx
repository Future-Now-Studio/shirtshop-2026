import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Loader2 } from 'lucide-react'
import { adminCreateCustomer } from '@/lib/adminApi'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'

export default function CustomerNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [terms, setTerms] = useState('14 Tage netto')

  const create = useMutation({
    mutationFn: () =>
      adminCreateCustomer({
        company,
        contactPerson: contact,
        email,
        phone: phone || undefined,
        discountPercent: discount ? Number(discount) : 0,
        paymentTerms: terms,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      navigate('/admin/kunden')
    },
  })

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück
      </button>
      <PageHeader title="Neuer Kunde" description="Ein Kunde = ein Zugang. E-Mail und Kontaktperson bilden den Login-Account." />

      <Card className="max-w-xl p-5">
        <div className="flex items-center gap-2">
          <Building2 className="size-4.5 text-brand" />
          <h3 className="font-semibold">Stammdaten &amp; Zugang</h3>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="co">Firma</Label>
            <Input id="co" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Muster GmbH" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ct">Ansprechpartner</Label>
              <Input id="ct" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ph">Telefon</Label>
              <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="em">E-Mail (Login)</Label>
            <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="einkauf@muster.de" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="di">Rabatt (%)</Label>
              <Input id="di" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="te">Zahlungsziel</Label>
              <Input id="te" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>
        </div>
        <Button variant="brand" className="mt-5 w-full" onClick={() => create.mutate()} disabled={!company || !contact || !email || create.isPending}>
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Kunde anlegen
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Legt Kd-Nr. &amp; Konditionen an. Bei aktivem Mailserver erhält die E-Mail-Adresse eine
          Einladung zum Passwort setzen und kann sich anschließend einloggen.
        </p>
      </Card>
    </div>
  )
}
