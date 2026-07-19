import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Package, MessageSquare, LogOut, Plus } from 'lucide-react'

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([])
  const [inquiries, setInquiries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('b2b_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Fetch inquiries
      const { data: inquiriesData } = await supabase
        .from('b2b_inquiries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])
      setInquiries(inquiriesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleReorder = async (orderId: string) => {
    // Implement reorder logic
    console.log('Reorder:', orderId)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Lade...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Package className="h-8 w-8 text-slate-900" />
            <span className="text-xl font-bold text-slate-900">Ballina</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/bulk-order">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Neue Bestellung
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">Willkommen zurück! Hier sind Ihre Bestellungen und Anfragen.</p>
        </div>

        {/* Orders */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Bestellungen</h2>
          {orders.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
              <Package className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4">Noch keine Bestellungen vorhanden.</p>
              <Link to="/bulk-order" className="mt-4 inline-block">
                <Button>Erste Bestellung aufgeben</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">Bestellung #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleDateString('de-DE')}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{order.description}</p>
                    </div>
                    <Button variant="outline" onClick={() => handleReorder(order.id)}>
                      Nachbestellen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inquiries */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">Anfragen</h2>
          {inquiries.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-4">Noch keine Anfragen vorhanden.</p>
              <Link to="/bulk-order" className="mt-4 inline-block">
                <Button>Anfrage senden</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">Anfrage #{inquiry.id.slice(0, 8)}</h3>
                      <p className="text-sm text-slate-600">
                        {new Date(inquiry.created_at).toLocaleDateString('de-DE')}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{inquiry.message}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700">
                      {inquiry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
