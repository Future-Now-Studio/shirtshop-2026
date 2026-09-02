import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, FileText, FileCheck2, Loader2, ShoppingBag, Wallet } from 'lucide-react'
import { adminGetStats } from '@/lib/adminApi'
import { formatEUR } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'

export default function AdminDashboard() {
  const { data: s, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminGetStats })

  if (isLoading || !s) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const kpis = [
    { label: 'Kunden', value: String(s.customers), icon: Building2, to: '/admin/kunden' },
    { label: 'Offene Bestellungen', value: String(s.openOrders), icon: ShoppingBag, to: '/admin/bestellungen' },
    { label: 'In Produktion', value: String(s.inProduction), icon: ShoppingBag, to: '/admin/bestellungen' },
    { label: 'Umsatz', value: formatEUR(s.revenue), icon: Wallet, to: '/admin/bestellungen' },
    { label: 'Neue Anfragen', value: String(s.openInquiries), icon: FileText, to: '/admin/anfragen' },
    { label: 'Offene Angebote', value: String(s.openQuotes), icon: FileCheck2, to: '/admin/angebote' },
  ]

  return (
    <div>
      <PageHeader title="Übersicht" description="Ihr Backoffice auf einen Blick." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <Card className="p-5 transition-colors hover:border-brand/40">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4.5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
