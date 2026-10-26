import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { adminCreateQuote, adminGetInquiry, adminGetQuote, adminUpdateQuote, type QuoteInput } from '@/lib/adminApi'
import { formatDate, formatEUR } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'
import { CustomerCombobox } from '@/components/CustomerCombobox'
import { berlinDatePlus, berlinToday, formatQty } from './adminFormat'
import {
  emptyPositionRow,
  PositionsEditor,
  rowsFromItems,
  summarizePositions,
  ZeroPriceConfirm,
  type PositionRow,
} from './PositionsEditor'

/** valid_until (timestamptz) → Berlin calendar date for the date input. */
function berlinDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

/**
 * New quote (optionally prefilled from ?anfrage=, ?kunde= or ?vorlage=<quote>)
 * or, under /admin/angebot/:id/bearbeiten, correction of an open quote.
 */
export default function QuoteNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id: editId } = useParams()
  const [params] = useSearchParams()
  const inquiryId = editId ? null : params.get('anfrage')
  const templateId = editId ?? params.get('vorlage')
  const presetCustomer = params.get('kunde')

  const inquiryQ = useQuery({
    queryKey: ['admin', 'inquiry', inquiryId],
    queryFn: () => adminGetInquiry(inquiryId!),
    enabled: !!inquiryId,
  })
  const templateQ = useQuery({
    queryKey: ['admin', 'quote', templateId],
    queryFn: () => adminGetQuote(templateId!),
    enabled: !!templateId,
  })

  const [companyId, setCompanyId] = useState(editId ? '' : presetCustomer ?? '')
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState(berlinDatePlus(30))
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<PositionRow[]>([{ ...emptyPositionRow }])
  const [allowZero, setAllowZero] = useState(false)

  // Prefill once per source (a later refetch must not overwrite the admin's edits).
  const source = inquiryId ? `anfrage:${inquiryId}` : templateId ? `angebot:${templateId}` : ''
  const prefilled = useRef('')
  useEffect(() => {
    if (!source || prefilled.current === source) return
    const inq = inquiryQ.data
    const tpl = templateQ.data
    if (inquiryId && inq) {
      prefilled.current = source
      setCompanyId(inq.companyId)
      setTitle(inq.productType)
      setRows([{ ...emptyPositionRow, productName: inq.productType, quantity: String(inq.quantity || 1) }])
    } else if (templateId && tpl) {
      prefilled.current = source
      setCompanyId(tpl.companyId)
      setTitle(tpl.title)
      setNote(tpl.note ?? '')
      setRows(rowsFromItems(tpl.items))
      if (tpl.items.some((it) => it.unitPrice === 0)) setAllowZero(true)
      // Editing keeps the validity unless it has already passed.
      if (editId && tpl.validUntil && berlinDateOf(tpl.validUntil) >= berlinToday()) setValidUntil(berlinDateOf(tpl.validUntil))
    }
  }, [source, inquiryId, templateId, editId, inquiryQ.data, templateQ.data])

  const { items, invalidRows, zeroRows, total } = summarizePositions(rows)
  const today = berlinToday()
  const dateInvalid = !validUntil || validUntil < today

  const save = useMutation({
    mutationFn: () => {
      const input: QuoteInput = {
        companyId,
        title: title.trim(),
        validUntil,
        note: note.trim() || undefined,
        items: items.map((it) => ({ productId: 'custom', imageUrl: '', ...it })),
        allowZeroPrice: zeroRows > 0 && allowZero,
        inquiryId: inquiryId ?? undefined,
      }
      // Quote, positions and the inquiry status are written in one transaction.
      return editId ? adminUpdateQuote(editId, input) : adminCreateQuote(input)
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'quotes'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'quote', quote.id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      navigate(`/admin/angebot/${quote.id}`, { replace: !!editId })
    },
  })

  const editBlocked = !!editId && !!templateQ.data && templateQ.data.status !== 'offen'
  const valid =
    !!companyId && !!title.trim() && !dateInvalid && items.length > 0 && invalidRows === 0 && (zeroRows === 0 || allowZero) && !editBlocked

  if ((inquiryId && inquiryQ.isLoading) || (templateId && templateQ.isLoading)) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  const loadError = (inquiryId && inquiryQ.error) || (templateId && templateQ.error)
  const missing = (inquiryId && inquiryQ.isSuccess && !inquiryQ.data) || (templateId && templateQ.isSuccess && !templateQ.data)

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zurück
      </button>
      <PageHeader
        title={editId ? `Angebot ${templateQ.data?.quoteNumber ?? ''} bearbeiten` : 'Neues Angebot'}
        description={
          editId
            ? 'Korrektur eines offenen Angebots. Der Kunde sieht die Änderung sofort im Portal.'
            : 'Angebot für einen Kunden zusammenstellen und senden.'
        }
      />

      {(loadError || missing) && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError
            ? `Vorlage konnte nicht geladen werden: ${(loadError as Error).message}`
            : inquiryId
              ? 'Die Anfrage wurde nicht gefunden.'
              : 'Das Angebot wurde nicht gefunden.'}
        </p>
      )}
      {editBlocked && (
        <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Dieses Angebot ist nicht mehr offen und kann nicht geändert werden. Über „Als Vorlage kopieren“
          lässt sich ein neues Angebot erstellen.
        </p>
      )}
      {inquiryQ.data && (
        <Card className="mb-6 p-4 text-sm">
          <p className="font-medium">Anfrage von {inquiryQ.data.companyName}</p>
          <p className="mt-1 text-muted-foreground">
            {inquiryQ.data.productType} · {formatQty(inquiryQ.data.quantity)} Stück
            {inquiryQ.data.deadline ? ` · bis ${formatDate(inquiryQ.data.deadline)}` : ''}
            {inquiryQ.data.message ? ` · „${inquiryQ.data.message}“` : ''}
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Positions */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Positionen</h3>
            <PositionsEditor
              rows={rows}
              onChange={setRows}
              placeholders={{ productName: 'z. B. Softshell-Jacke', color: 'Schwarz', size: 'L' }}
            />
          </Card>

          <Card className="p-5">
            <Label htmlFor="note">Hinweis zum Angebot (optional, für den Kunden sichtbar)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Staffelpreise, Druckkosten, Lieferzeit…" maxLength={2000} />
          </Card>
        </div>

        {/* Meta / submit */}
        <Card className="h-fit space-y-4 p-5">
          {/* Fixed when editing, or when answering a customer's inquiry. */}
          <CustomerCombobox value={companyId} onChange={setCompanyId} disabled={!!editId || !!inquiryQ.data?.companyId} />
          <div>
            <Label htmlFor="title">Titel</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Winterjacken 2026" maxLength={200} />
          </div>
          <div>
            <Label htmlFor="valid">Gültig bis (einschließlich)</Label>
            <Input id="valid" type="date" min={today} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} aria-invalid={dateInvalid || undefined} />
            {dateInvalid && <p className="mt-1 text-xs text-destructive">Bitte ein Datum ab heute wählen.</p>}
          </div>

          <div className="flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Angebotssumme (netto)</span>
            <span className="font-semibold">{formatEUR(total)}</span>
          </div>

          <ZeroPriceConfirm count={zeroRows} checked={allowZero} onChange={setAllowZero} />

          <Button variant="brand" className="w-full" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {editId ? 'Änderungen speichern' : 'Angebot senden'}
          </Button>
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {editId ? 'Nicht gespeichert' : 'Angebot nicht angelegt'}: {(save.error as Error).message}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {editId
              ? 'Es wird keine neue E-Mail versendet.'
              : 'Der Kunde sieht das Angebot sofort in seinem Portal und erhält eine E-Mail.'}
          </p>
        </Card>
      </div>
    </div>
  )
}
