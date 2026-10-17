import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { adminGetAudit, type AuditCursor } from '@/lib/adminApi'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import type { AuditEntry } from '@/lib/types'

function when(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function actorLabel(e: AuditEntry): string {
  if (e.actorEmail) return e.actorEmail
  if (!e.actor) return 'System'
  return `Benutzer ${e.actor.slice(0, 8)}…`
}

export default function AuditLog() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'audit'],
    queryFn: ({ pageParam }) => adminGetAudit(pageParam),
    initialPageParam: undefined as AuditCursor | undefined,
    getNextPageParam: (last) => {
      const tail = last.rows[last.rows.length - 1]
      return last.hasMore && tail ? { at: tail.at, id: tail.id } : undefined
    },
  })
  const entries = data?.pages.flatMap((p) => p.rows) ?? []

  return (
    <div>
      <PageHeader title="Audit-Log" description="Lückenlose Protokollierung aller Backoffice- und Kundenaktionen." />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
          Audit-Log konnte nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[150px_200px_170px_1fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Zeitpunkt</span>
              <span>Benutzer</span>
              <span>Aktion</span>
              <span>Detail</span>
            </div>
            <div className="divide-y divide-border">
              {entries.map((e) => (
                <div key={e.id} className="grid grid-cols-1 gap-1 px-5 py-3 text-sm lg:grid-cols-[150px_200px_170px_1fr] lg:gap-4">
                  <span className="tabular-nums text-muted-foreground">{when(e.at)}</span>
                  <span className="min-w-0 truncate" title={e.actorEmail ?? e.actor}>{actorLabel(e)}</span>
                  <span className="font-mono text-xs text-brand">{e.action}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{e.entity}</span>
                    {e.companyName && e.companyName !== e.entity && (
                      <span className="text-muted-foreground"> · {e.companyName}</span>
                    )}
                    {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
                  </span>
                </div>
              ))}
              {entries.length === 0 && (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">Noch keine Einträge.</p>
              )}
            </div>
          </Card>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'} geladen</span>
            {hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                Mehr laden
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
