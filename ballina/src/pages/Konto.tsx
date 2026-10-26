import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { getCompany, updateMyDeliveryAddress, updateMyProfile } from '@/lib/api'
import { changePassword, PASSWORD_MIN_LENGTH, useAuth } from '@/lib/auth'
import { COMPANY, isFilled } from '@/lib/legal'
import { USE_MOCK } from '@/lib/supabase'
import { formatEUR } from '@/lib/utils'
import type { Address } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { LoadError, LoadingState } from '@/components/ui/load-state'
import { PageHeader } from '@/components/PageHeader'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || '—'}</dd>
    </div>
  )
}

function Saved({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
      <CheckCircle2 className="size-4" /> Gespeichert
    </span>
  )
}

const formatAddress = (a?: Address) => (a ? `${a.line1}, ${a.zip} ${a.city}${a.country ? `, ${a.country}` : ''}` : '')

/** "Mein Konto": company conditions (read-only), contact person, default delivery address, password. */
export default function Konto() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: company, isLoading, isError, refetch } = useQuery({ queryKey: ['company'], queryFn: getCompany })

  // Contact person
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // Default delivery address
  const [line1, setLine1] = useState('')
  const [zip, setZip] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  // Fill each form from the stored values. Separate effects keyed on the
  // values themselves: saving one form (→ refetch) keeps unsaved edits in the other.
  const contact = company?.contactPerson
  const contactPhone = company?.phone
  useEffect(() => {
    if (contact === undefined) return
    setName(contact)
    setPhone(contactPhone ?? '')
  }, [contact, contactPhone])
  const del = company?.deliveryAddress
  const loaded = !!company
  useEffect(() => {
    if (!loaded) return
    setLine1(del?.line1 ?? '')
    setZip(del?.zip ?? '')
    setCity(del?.city ?? '')
    setCountry(del?.country ?? '')
  }, [loaded, del?.line1, del?.zip, del?.city, del?.country])

  const saveProfile = useMutation({
    mutationFn: () => updateMyProfile(name, phone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  })
  const saveAddress = useMutation({
    mutationFn: (reset: boolean) =>
      updateMyDeliveryAddress(reset ? null : { line1, zip, city, country: country || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  })

  // Password
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pwError, setPwError] = useState('')
  const savePassword = useMutation({
    mutationFn: () => changePassword(user?.email ?? '', current, next),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      setRepeat('')
    },
  })

  if (isLoading) return <LoadingState />
  if (isError || !company) return <LoadError what="Ihre Kontodaten" onRetry={() => refetch()} />

  const addressComplete = !!(line1.trim() && zip.trim() && city.trim())

  return (
    <div>
      <PageHeader title="Mein Konto" description="Ihre Firmendaten, Ansprechpartner, Lieferadresse und Ihr Passwort." />

      {USE_MOCK && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Demo-Modus: Änderungen können hier nicht gespeichert werden.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company data + conditions (maintained by the back office) */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold tracking-tight">Firma &amp; Konditionen</h2>
          <dl className="mt-3 divide-y divide-border">
            <Row label="Firma">{company.company}</Row>
            <Row label="Kundennummer">{company.customerNumber}</Row>
            <Row label="USt-IdNr.">{company.vatId}</Row>
            <Row label="Rechnungsadresse">{formatAddress(company.billingAddress)}</Row>
            <Row label="Zahlungsbedingungen">{company.paymentTerms}</Row>
            <Row label="Jahresbudget (netto)">{company.annualBudget ? formatEUR(company.annualBudget) : ''}</Row>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Firmendaten, Rechnungsadresse und Konditionen pflegt das {COMPANY.brand}-Team. Änderungen
            teilen Sie uns bitte{isFilled(COMPANY.email) ? ` per E-Mail an ${COMPANY.email}` : ''} mit.
          </p>
        </Card>

        {/* Contact person */}
        <Card className="p-5">
          <h2 className="font-semibold tracking-tight">Ansprechpartner</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveProfile.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="k-name">Name *</Label>
              <Input id="k-name" value={name} maxLength={200} required autoComplete="name"
                onChange={(e) => { setName(e.target.value); saveProfile.reset() }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-phone">Telefon</Label>
              <Input id="k-phone" type="tel" value={phone} maxLength={40} autoComplete="tel" placeholder="+49 …"
                onChange={(e) => { setPhone(e.target.value); saveProfile.reset() }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-mail">E-Mail (Anmeldung)</Label>
              <Input id="k-mail" value={company.email} disabled />
              <p className="text-xs text-muted-foreground">Die Anmelde-E-Mail ändert das {COMPANY.brand}-Team auf Anfrage.</p>
            </div>
            {saveProfile.isError && <p role="alert" className="text-sm text-destructive">{(saveProfile.error as Error).message}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" variant="brand" disabled={USE_MOCK || saveProfile.isPending || !name.trim()}>
                {saveProfile.isPending && <Loader2 className="size-4 animate-spin" />}
                Speichern
              </Button>
              <Saved show={saveProfile.isSuccess} />
            </div>
          </form>
        </Card>

        {/* Default delivery address */}
        <Card className="p-5">
          <h2 className="font-semibold tracking-tight">Standard-Lieferadresse</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Wird bei jeder Bestellung vorausgefüllt und kann dort im Einzelfall geändert werden.
            {!company.deliveryAddress && ' Aktuell wird die Rechnungsadresse verwendet.'}
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveAddress.mutate(false)
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="k-line1">Straße und Hausnummer (ggf. mit Abteilung)</Label>
              <Input id="k-line1" value={line1} maxLength={200} autoComplete="street-address"
                onChange={(e) => { setLine1(e.target.value); saveAddress.reset() }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="k-zip">PLZ</Label>
                <Input id="k-zip" value={zip} maxLength={12} autoComplete="postal-code"
                  onChange={(e) => { setZip(e.target.value); saveAddress.reset() }} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="k-city">Ort</Label>
                <Input id="k-city" value={city} maxLength={100} autoComplete="address-level2"
                  onChange={(e) => { setCity(e.target.value); saveAddress.reset() }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-country">Land</Label>
              <Input id="k-country" value={country} maxLength={100} placeholder="Deutschland" autoComplete="country-name"
                onChange={(e) => { setCountry(e.target.value); saveAddress.reset() }} />
            </div>
            {saveAddress.isError && <p role="alert" className="text-sm text-destructive">{(saveAddress.error as Error).message}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="brand" disabled={USE_MOCK || saveAddress.isPending || !addressComplete}>
                {saveAddress.isPending && <Loader2 className="size-4 animate-spin" />}
                Speichern
              </Button>
              {company.deliveryAddress && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={USE_MOCK || saveAddress.isPending}
                  onClick={() => confirm('Standard-Lieferadresse entfernen und künftig die Rechnungsadresse verwenden?') && saveAddress.mutate(true)}
                >
                  Rechnungsadresse verwenden
                </Button>
              )}
              <Saved show={saveAddress.isSuccess} />
            </div>
          </form>
        </Card>

        {/* Password */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold tracking-tight">Passwort ändern</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              setPwError('')
              savePassword.reset()
              if (next.length < PASSWORD_MIN_LENGTH) return setPwError(`Das neue Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`)
              if (next !== repeat) return setPwError('Die neuen Passwörter stimmen nicht überein.')
              savePassword.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="k-pw-current">Aktuelles Passwort</Label>
              <Input id="k-pw-current" type="password" autoComplete="current-password" required value={current}
                onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-pw-new">Neues Passwort</Label>
              <Input id="k-pw-new" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} value={next}
                onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-pw-repeat">Neues Passwort wiederholen</Label>
              <Input id="k-pw-repeat" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} value={repeat}
                onChange={(e) => setRepeat(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Mindestens {PASSWORD_MIN_LENGTH} Zeichen. Bitte kein Passwort verwenden, das Sie schon anderswo nutzen.
            </p>
            {(pwError || savePassword.isError) && (
              <p role="alert" className="text-sm text-destructive sm:col-span-3">
                {pwError || (savePassword.error as Error).message}
              </p>
            )}
            <div className="flex items-center gap-3 sm:col-span-3">
              <Button type="submit" variant="brand" disabled={USE_MOCK || savePassword.isPending}>
                {savePassword.isPending && <Loader2 className="size-4 animate-spin" />}
                Passwort ändern
              </Button>
              <Saved show={savePassword.isSuccess} />
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
