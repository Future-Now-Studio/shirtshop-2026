import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Loader2, Mail, Phone, PlayCircle } from 'lucide-react'
import {
  adminGetInquiriesPage,
  adminGetInquiryCounts,
  adminSetInquiryStatus,
  type InquiryFilter,
} from '@/lib/adminApi'
import type { AdminInquiry } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { ArtworkLink } from '@/components/ArtworkLink'
import { formatQty } from './adminFormat'

const STATUS_LABELS: Record<AdminInquiry['status'], string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  angebot_gesendet: 'Angebot gesendet',
  abgeschlossen: 'Abgeschlossen',
}

const FILTERS: { key: InquiryFilter; label: string; empty: string }[] = [
  { key: 'offen', label: 'Offen', empty: 'Keine offenen Anfragen.' },
  { key: 'neu', label: 'Neu', empty: 'Keine neuen Anfragen.' },
  { key: 'angebot_gesendet', label: 'Angebot gesendet', empty: 'Keine Anfragen mit gesendetem Angebot.' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', empty: 'Keine abgeschlossenen Anfragen.' },
  { key: 'alle', label: 'Alle', empty: 'Noch keine Anfragen eingegangen.' },
]
const FILTER_KEYS = FILTERS.map((f) => f.key)

export default function Inquiries() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const rawFilter = params.get('filter') as InquiryFilter | null
  const filter: InquiryFilter = rawFilter && FILTER_KEYS.includes(rawFilter) ? rawFilter : 'offen'
  function setFilter(f: InquiryFilter) {
    const next = new URLSearchParams(params)
    if (f === 'offen') next.delete('filter')
    else next.set('filter', f)
    setParams(next, { replace: true })
  }

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'inquiries', 'list', filter],
    queryFn: ({ pageParam }) => adminGetInquiriesPage(filter, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((n, p) => n + p.rows.length, 0) : undefined,
    placeholderData: keepPreviousData,
  })
  const { data: counts } = useQuery({ queryKey: ['admin', 'inquiries', 'counts'], queryFn: adminGetInquiryCounts })
  const inquiries = data?.pages.flatMap((p) => p.rows) ?? []
  const total = data?.pages[0]?.total

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminInquiry['status'] }) =>
      adminSetInquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  return (
    <div>
      <PageHeader title="Anfragen" description="Eingehende Großanfragen – prüfen und in ein Angebot überführen." />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f.key
                ? 'border-brand bg-brand-muted text-brand'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
            {f.key !== 'alle' && counts && <span className="ml-1 text-xs">({counts[f.key]})</span>}
          </button>
        ))}
      </div>

      {setStatus.isError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Status nicht geändert: {(setStatus.error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
          Anfragen konnten nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
      ) : inquiries.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </div>
          <p className="font-medium">{FILTERS.find((f) => f.key === filter)?.empty}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((i) => (
            <Card key={i.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">{i.productType}</span>
                    <Badge variant={i.status === 'neu' ? 'info' : i.status === 'abgeschlossen' ? 'neutral' : i.status === 'in_bearbeitung' ? 'warning' : 'success'}>
                      {STATUS_LABELS[i.status] ?? i.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    {i.companyId ? (
                      <Link to={`/admin/kunde/${i.companyId}`} className="font-medium hover:text-brand">
                        {i.companyName}
                      </Link>
                    ) : (
                      <span className="font-medium">{i.companyName}</span>
                    )}
                    <span className="text-muted-foreground">
                      {' '}· {i.contactPerson || '—'} · {formatDate(i.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {i.email && (
                      <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Mail className="size-3.5" /> {i.email}
                      </a>
                    )}
                    {i.phone && (
                      <a href={`tel:${i.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="size-3.5" /> {i.phone}
                      </a>
                    )}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatQty(i.quantity)} Stück
                    {i.deadline ? ` · bis ${formatDate(i.deadline)}` : ''}
                  </p>
                  {i.message && <p className="mt-1 whitespace-pre-line text-sm">„{i.message}“</p>}
                  {i.artworkPath && (
                    <div className="mt-1.5">
                      <ArtworkLink path={i.artworkPath} name={i.artworkName} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {i.status === 'neu' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus.mutate({ id: i.id, status: 'in_bearbeitung' })}
                      disabled={setStatus.isPending}
                    >
                      <PlayCircle className="size-4" />
                      In Bearbeitung
                    </Button>
                  )}
                  {i.status !== 'abgeschlossen' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus.mutate({ id: i.id, status: 'abgeschlossen' })}
                      disabled={setStatus.isPending}
                    >
                      <Check className="size-4" />
                      Als erledigt
                    </Button>
                  )}
                  {i.status !== 'abgeschlossen' && (
                    <Link to={`/admin/angebote/neu?anfrage=${i.id}`}>
                      <Button variant="brand" size="sm">
                        Angebot erstellen
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
            <span>
              {inquiries.length}
              {total != null ? ` von ${total}` : ''} Anfragen
            </span>
            {hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                Mehr laden
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
