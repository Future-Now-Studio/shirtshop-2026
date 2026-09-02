import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { OrderFlowProvider } from '@/lib/orderFlow'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { AppLayout } from '@/components/AppLayout'
import { AdminLayout } from '@/components/AdminLayout'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Orders from '@/pages/Orders'
import OrderDetail from '@/pages/OrderDetail'
import OrderSuccess from '@/pages/OrderSuccess'
import Angebote from '@/pages/Angebote'
import { CookieConsent } from '@/components/CookieConsent'

// Split off less-frequent / admin-only screens so customers never download the
// back-office bundle and the initial payload stays small.
const Legal = lazy(() => import('@/pages/Legal'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const Customers = lazy(() => import('@/pages/admin/Customers'))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminOrderNew = lazy(() => import('@/pages/admin/AdminOrderNew'))
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'))
const Inquiries = lazy(() => import('@/pages/admin/Inquiries'))
const AdminQuotes = lazy(() => import('@/pages/admin/AdminQuotes'))
const AdminQuoteDetail = lazy(() => import('@/pages/admin/AdminQuoteDetail'))
const QuoteNew = lazy(() => import('@/pages/admin/QuoteNew'))
const AdminCustomerDetail = lazy(() => import('@/pages/admin/AdminCustomerDetail'))
const CustomerNew = lazy(() => import('@/pages/admin/CustomerNew'))
const AuditLog = lazy(() => import('@/pages/admin/AuditLog'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

function PageFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <OrderFlowProvider>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/impressum" element={<Legal doc="impressum" />} />
            <Route path="/datenschutz" element={<Legal doc="datenschutz" />} />
            <Route path="/agb" element={<Legal doc="agb" />} />
            <Route path="/widerruf" element={<Legal doc="widerruf" />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/bestellungen" element={<Orders />} />
              <Route path="/bestellung/:id" element={<OrderDetail />} />
              <Route path="/bestellung-erfolg/:id" element={<OrderSuccess />} />
              <Route path="/angebote" element={<Angebote />} />
              <Route path="/anfrage" element={<Navigate to="/angebote?tab=anfrage" replace />} />
              {/* Entferntes Dashboard / ausgeblendeter Katalog → auf Bestellungen leiten. */}
              <Route path="/dashboard" element={<Navigate to="/bestellungen" replace />} />
              <Route path="/warenkorb" element={<Navigate to="/bestellungen" replace />} />
              <Route path="/katalog" element={<Navigate to="/bestellungen" replace />} />
              <Route path="/produkt/:id" element={<Navigate to="/bestellungen" replace />} />
            </Route>

            {/* Back-office */}
            <Route
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/kunden" element={<Customers />} />
              <Route path="/admin/kunden/neu" element={<CustomerNew />} />
              <Route path="/admin/kunde/:id" element={<AdminCustomerDetail />} />
              <Route path="/admin/bestellungen" element={<AdminOrders />} />
              <Route path="/admin/bestellungen/neu" element={<AdminOrderNew />} />
              <Route path="/admin/bestellung/:id" element={<AdminOrderDetail />} />
              <Route path="/admin/anfragen" element={<Inquiries />} />
              <Route path="/admin/angebote" element={<AdminQuotes />} />
              <Route path="/admin/angebote/neu" element={<QuoteNew />} />
              <Route path="/admin/angebot/:id" element={<AdminQuoteDetail />} />
              <Route path="/admin/audit" element={<AuditLog />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          <CookieConsent />
          </OrderFlowProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
