import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { adminGetQuotes } from '@/lib/adminApi'
import { formatDate, formatEUR } from '@/lib/utils'
import { QUOTE_STATUS_LABELS, type Quote } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

const VARIANT: Record<Quote['status'], 'info' | 'success' | 'destructive' | 'neutral'> = {
  offen: 'info',
  angenommen: 'success',
  abgelehnt: 'destructive',
  abgelaufen: 'neutral',
}

export default function AdminQuotes() {
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['admin', 'quotes'],
    queryFn: adminGetQuotes,
  })

  return (
    <div>
      <PageHeader
        title="Angebote"
        description="Erstellte Angebote und ihr Status."
        action={
          <Link to="/admin/angebote/neu">
            <Button variant="brand" size="lg">
              <Plus className="size-4" />
              Neues Angebot
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <Link key={q.id} to={`/admin/angebot/${q.id}`} className="block">
            <Card className="p-5 transition-colors hover:border-brand/40">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">{q.title}</span>
                    <Badge variant={VARIANT[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {q.quoteNumber} · {q.companyName} · vom {formatDate(q.createdAt)} · gültig bis{' '}
                    {formatDate(q.validUntil)}
                  </p>
                </div>
                <span className="text-lg font-semibold tracking-tight">{formatEUR(q.total)}</span>
              </div>
            </Card>
            </Link>
          ))}
          {quotes.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Noch keine Angebote. Erstellen Sie eines aus einer Anfrage oder neu.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
