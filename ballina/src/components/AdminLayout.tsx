import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Building2,
  ShoppingBag,
  FileText,
  FileCheck2,
  ScrollText,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { adminGetStats } from '@/lib/adminApi'
import { BrandMark } from './BrandMark'

const NAV = [
  { to: '/admin', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/admin/kunden', label: 'Kunden', icon: Building2 },
  { to: '/admin/bestellungen', label: 'Bestellungen', icon: ShoppingBag },
  { to: '/admin/anfragen', label: 'Anfragen', icon: FileText },
  { to: '/admin/angebote', label: 'Angebote', icon: FileCheck2 },
  { to: '/admin/audit', label: 'Audit-Log', icon: ScrollText },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: stats } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminGetStats })

  const badges: Record<string, number | undefined> = {
    '/admin/anfragen': stats?.openInquiries,
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
            <BrandMark />
          </Link>
          <button className="text-muted-foreground lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Menü schließen">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-background">
            Backoffice
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-muted text-brand'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-4.5" />
              <span className="flex-1">{label}</span>
              {badges[to] ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold text-brand-foreground">
                  {badges[to]}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4.5" />
            Abmelden
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <button className="text-muted-foreground lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menü öffnen">
            <Menu className="size-5" />
          </button>
          <p className="text-sm font-medium text-muted-foreground">Ballina · Backoffice</p>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
