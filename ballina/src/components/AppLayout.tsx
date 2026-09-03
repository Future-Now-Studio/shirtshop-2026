import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, FileCheck2, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { getCompany } from '@/lib/api'
import { BrandMark } from './BrandMark'

// `match` keeps the item active on the singular detail routes too
// (/bestellung/:id) which don't share the plural nav prefix.
const NAV = [
  { to: '/bestellungen', label: 'Bestellungen', icon: ShoppingBag, match: ['/bestellungen', '/bestellung'] },
  { to: '/angebote', label: 'Angebote & Anfragen', icon: FileCheck2, match: ['/angebote', '/anfrage'] },
]

/** Active when the path equals a prefix or is a sub-route of it. */
function isNavActive(pathname: string, match: string[]): boolean {
  return match.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function AppLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link to="/bestellungen" onClick={() => setMobileOpen(false)}>
            <BrandMark />
          </Link>
          <button
            className="text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, match }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isNavActive(pathname, match)
                  ? 'bg-brand-muted text-brand'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg bg-muted/60 px-3 py-2.5">
            <p className="truncate text-sm font-medium">{company?.company ?? 'Ballina B2B'}</p>
            {company?.customerNumber && (
              <p className="truncate text-xs text-muted-foreground">
                Kd-Nr. {company.customerNumber}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4.5" />
            Abmelden
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <button
            className="text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="ml-auto" />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
