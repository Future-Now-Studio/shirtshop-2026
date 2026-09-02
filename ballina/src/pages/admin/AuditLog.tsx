import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { adminGetAudit } from '@/lib/adminApi'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'

function when(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export default function AuditLog() {
  const { data: entries = [], isLoading } = useQuery({ queryKey: ['admin', 'audit'], queryFn: adminGetAudit })

  return (
    <div>
      <PageHeader title="Audit-Log" description="Lückenlose Protokollierung aller Backoffice-Aktionen." />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[160px_180px_1fr] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Zeitpunkt</span>
            <span>Aktion</span>
            <span>Detail</span>
          </div>
          <div className="divide-y divide-border">
            {entries.map((e) => (
              <div key={e.id} className="grid grid-cols-1 gap-1 px-5 py-3 text-sm sm:grid-cols-[160px_180px_1fr] sm:gap-4">
                <span className="tabular-nums text-muted-foreground">{when(e.at)}</span>
                <span className="font-mono text-xs text-brand">{e.action}</span>
                <span>
                  <span className="font-medium">{e.entity}</span>
                  <span className="text-muted-foreground"> · {e.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
