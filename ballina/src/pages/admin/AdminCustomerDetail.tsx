import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2, Mail, RefreshCw } from 'lucide-react'
import { adminGetBudgetSpent, adminGetCustomer, adminResendInvite, adminUpdateCustomer } from '@/lib/adminApi'
import { berlinYear } from '@/lib/utils'
import type { Address } from '@/lib/types'
import { BudgetBar } from '@/components/BudgetBar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { InternalNotes } from './InternalNotes'
import { formatDecimal, parseDecimal } from './adminFormat'

/** Address from the three inputs (keeps the stored country); undefined (= clear) when all are empty. */
function addressFrom(line1: string, zip: string, city: string, country?: string): Address | undefined {
  const a = { line1: line1.trim(), zip: zip.trim(), city: city.trim(), country }
  if (!a.line1 && !a.zip && !a.city) return undefined
  if (!a.line1 || !a.zip || !a.city) throw new Error('Bitte Straße, PLZ und Ort vollständig angeben (oder alle drei Felder leeren).')
  return a
}

export default function AdminCustomerDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: customer, isLoading, isError, error, refetch } = useQuery({
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

  const [company, setCompany] = useState('')
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
      setCompany(customer.company)
      setDiscount(formatDecimal(customer.discountPercent ?? 0).replace(/,00$/, ''))
      setBudget(customer.annualBudget != null ? formatDecimal(customer.annualBudget).replace(/,00$/, '') : '')
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

  const discountValue = discount.trim() ? parseDecimal(discount) : 0
  const discountInvalid = !Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100
  const budgetValue = budget.trim() ? parseDecimal(budget) : undefined
  const budgetInvalid = budgetValue !== undefined && (!Number.isFinite(budgetValue) || budgetValue < 0)

  const save = useMutation({
    mutationFn: () => {
      if (!company.trim()) throw new Error('Bitte einen Firmennamen angeben.')
      if (discountInvalid) throw new Error('Rabatt muss zwischen 0 und 100 % liegen.')
      if (budgetInvalid) throw new Error('Das Jahresbudget darf nicht negativ sein.')
      return adminUpdateCustomer(id, {
        company: company.trim(),
        discountPercent: Math.round(discountValue * 100) / 100,
        // undefined clears the budget / an address (see adminUpdateCustomer)
        annualBudget: budgetValue !== undefined ? Math.round(budgetValue * 100) / 100 : undefined,
        paymentTerms: terms.trim(),
        contactPerson: contact.trim(),
        phone: phone.trim(),
        vatId: vatId.trim(),
        billingAddress: addressFrom(bLine, bZip, bCity, customer?.billingAddress?.country),
        deliveryAddress: addressFrom(dLine, dZip, dCity, customer?.deliveryAddress?.country),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const resend = useMutation({
    mutationFn: () => adminResendInvite(customer!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] }),
  })

  function onResend() {
    if (!customer?.email) return
    if (!window.confirm(`Einladung erneut an ${customer.email} senden? Der Kunde erhält eine neue E-Mail mit einem Link zum Passwort setzen.`)) return
    resend.mutate()
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
          Kunde konnte nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="size-4" /> Erneut versuchen
        </Button>
      </Card>
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
          <h3 className="text-sm font-semibold">Firma &amp; Konditionen</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="company">Firmenname</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="disc">Rabatt (%) – Richtwert</Label>
              <Input id="disc" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-invalid={discountInvalid || undefined} aria-describedby="disc-hint" placeholder="0" />
              {discountInvalid ? (
                <p className="mt-1 text-xs text-destructive">0 bis 100 %</p>
              ) : (
                <p id="disc-hint" className="mt-1 text-xs text-muted-foreground">
                  Interner Richtwert für Angebote – wird nicht automatisch abgezogen, der Kunde sieht ihn nicht.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="bud">Jahresbudget (€ netto)</Label>
              <Input id="bud" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} aria-invalid={budgetInvalid || undefined} aria-describedby="bud-hint" placeholder="ohne Budget" />
              {budgetInvalid ? (
                <p className="mt-1 text-xs text-destructive">Bitte einen Betrag ≥ 0 eingeben.</p>
              ) : (
                <p id="bud-hint" className="mt-1 text-xs text-muted-foreground">
                  Nur zur Information (Kunde sieht es) – blockiert keine Bestellungen.
                </p>
              )}
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
            <div>
              <p className="text-sm text-muted-foreground">E-Mail (Login): {customer.email || '—'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Die Login-Adresse kann hier nicht geändert werden. Einladung verloren oder abgelaufen? Solange der
                Kunde noch kein Passwort gesetzt hat, hier erneut senden – danach nutzt er auf der Login-Seite
                „Passwort vergessen?“.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={onResend} disabled={!customer.email || resend.isPending}>
                  {resend.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  Einladung erneut senden
                </Button>
                {resend.isSuccess && !resend.isPending && (
                  <span role="status" className="text-sm text-muted-foreground">
                    Einladung an {customer.email} erneut gesendet.
                  </span>
                )}
                {resend.isError && (
                  <span role="alert" className="text-sm text-destructive">
                    Einladung nicht gesendet: {(resend.error as Error).message}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Adressen &amp; Steuer</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Erscheint beim Kunden unter „Rechnung an“ und als Standard-Lieferadresse. Alle drei Felder leeren, um
            eine Adresse zu entfernen.
          </p>
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending || discountInvalid || budgetInvalid}>
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

      <InternalNotes className="mt-6" target={{ companyId: customer.id }} />
    </div>
  )
}
