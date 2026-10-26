import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Inbox } from 'lucide-react'
import { getInquiries, getQuotes } from '@/lib/api'
import { formatDate, formatDay } from '@/lib/utils'
import { INQUIRY_STATUS_LABELS, type Inquiry } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadError, LoadingState } from '@/components/ui/load-state'
import { ArtworkLink } from '@/components/ArtworkLink'

const STATUS_VARIANT: Record<Inquiry['status'], 'info' | 'warning' | 'success' | 'neutral'> = {
  neu: 'info',
  in_bearbeitung: 'warning',
  angebot_gesendet: 'success',
  abgeschlossen: 'neutral',
}

/** "Meine Anfragen": the company's inquiries with status and the resulting quote. */
export default function MyInquiries({ onNew }: { onNew: () => void }) {
  const { data: inquiries = [], isLoading, isError, refetch } = useQuery({ queryKey: ['inquiries'], queryFn: getInquiries })
  // Quotes carry inquiry_id when the back office created them from an inquiry.
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes'], queryFn: getQuotes })

  if (isLoading) return <LoadingState />
  if (isError) return <LoadError what="Ihre Anfragen" onRetry={() => refetch()} />

  if (inquiries.length === 0) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="size-6" />
        </div>
        <p className="font-medium">Noch keine Anfragen</p>
        <p className="text-sm text-muted-foreground">
          Beschreiben Sie Artikel, Menge und Veredelung – wir erstellen Ihnen ein Angebot.
        </p>
        <Button variant="brand" onClick={onNew}>
          Neue Anfrage
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {inquiries.map((inq) => {
        const linked = quotes.filter((q) => q.inquiryId === inq.id)
        return (
          <Card key={inq.id} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">{inq.productType}</span>
                  <Badge variant={STATUS_VARIANT[inq.status]}>{INQUIRY_STATUS_LABELS[inq.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gesendet am {formatDate(inq.createdAt)} · {inq.quantity} Stück
                  {inq.deadline ? ` · Wunschtermin ${formatDay(inq.deadline)}` : ''}
                </p>
                {inq.message && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{inq.message}</p>
                )}
                {inq.artworkPath && (
                  <div className="mt-2">
                    <ArtworkLink path={inq.artworkPath} name={inq.artworkName} />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                {linked.map((q) => (
                  <Link key={q.id} to={`/angebote?tab=angebote&angebot=${q.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Angebot {q.quoteNumber} <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                ))}
                {linked.length === 0 && inq.status === 'angebot_gesendet' && (
                  <Link to="/angebote?tab=angebote">
                    <Button variant="outline" size="sm" className="w-full">
                      Zu den Angeboten <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
