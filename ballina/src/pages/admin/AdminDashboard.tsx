import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, FileText, FileCheck2, Loader2, RefreshCw, ShoppingBag, Wallet } from 'lucide-react'
import { adminGetStats } from '@/lib/adminApi'
import { formatEUR } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function AdminDashboard() {
  const { data: s, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminGetStats,
  })

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (isError || !s) {
    return (
      <div>
        <PageHeader title="Übersicht" description="Ihr Backoffice auf einen Blick." />
        <Card className="grid place-items-center gap-3 py-12 text-center">
          <p className="text-sm text-destructive">
            Kennzahlen konnten nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
          </p>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="size-4" /> Erneut versuchen
          </Button>
        </Card>
      </div>
    )
  }

  const kpis = [
    { label: 'Preise unbestätigt', value: String(s.unconfirmedOrders), icon: AlertTriangle, to: '/admin/bestellungen?filter=unbestaetigt', alert: s.unconfirmedOrders > 0 },
    { label: 'Offene Reklamationen', value: String(s.openReclamations), icon: AlertTriangle, to: '/admin/bestellungen?filter=reklamation', alert: s.openReclamations > 0 },
    { label: 'Neue Anfragen', value: String(s.openInquiries), icon: FileText, to: '/admin/anfragen?filter=neu' },
    { label: 'Offene Angebote', value: String(s.openQuotes), icon: FileCheck2, to: '/admin/angebote?filter=offen' },
    { label: 'Offene Bestellungen', value: String(s.openOrders), icon: ShoppingBag, to: '/admin/bestellungen?filter=offen' },
    { label: 'In Bearbeitung', value: String(s.inProduction), icon: ShoppingBag, to: '/admin/bestellungen?filter=in_bearbeitung' },
    {
      label: `Auftragswert ${s.year} (netto)`,
      value: s.orderValueYear != null ? formatEUR(s.orderValueYear) : '—',
      hint:
        s.orderValueYear != null
          ? `${s.ordersYear ?? 0} Bestellungen · Warenwert + Versand, ohne Stornos und unbestätigte Preise`
          : 'Wird nach Einspielen von Migration 013 berechnet.',
      icon: Wallet,
      to: '/admin/bestellungen',
    },
    { label: 'Kunden', value: String(s.customers), icon: Building2, to: '/admin/kunden' },
  ]

  return (
    <div>
      <PageHeader title="Übersicht" description="Ihr Backoffice auf einen Blick." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, to, alert, hint }) => (
          <Link key={label} to={to}>
            <Card className={'h-full p-5 transition-colors hover:border-brand/40 ' + (alert ? 'border-amber-300' : '')}>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <div
                  className={
                    'grid size-9 place-items-center rounded-lg ' +
                    (alert ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground')
                  }
                >
                  <Icon className="size-4.5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
              {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
