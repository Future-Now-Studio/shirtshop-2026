import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Users, Package, MessageSquare } from 'lucide-react'

export default function Admin() {
  const [orders, setOrders] = useState<any[]>([])
  const [inquiries, setInquiries] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'orders' | 'inquiries' | 'users'>('orders')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch orders
      const { data: ordersData } = await supabase
        .from('b2b_orders')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch inquiries
      const { data: inquiriesData } = await supabase
        .from('b2b_inquiries')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch users
      const { data: usersData } = await supabase
        .from('b2b_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])
      setInquiries(inquiriesData || [])
      setUsers(usersData || [])
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateInquiryStatus = async (id: string, status: string) => {
    try {
      await supabase
        .from('b2b_inquiries')
        .update({ status })
        .eq('id', id)
      fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
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
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-5 w-5" />
            <span>Zurück zur Startseite</span>
          </Link>
          <span className="text-xl font-bold text-slate-900">Ballina Admin</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-2 text-slate-600">Verwalten Sie B2B-Bestellungen, Anfragen und Benutzer.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'orders'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="mr-2 inline h-4 w-4" />
            Bestellungen ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'inquiries'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="mr-2 inline h-4 w-4" />
            Anfragen ({inquiries.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'users'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="mr-2 inline h-4 w-4" />
            Benutzer ({users.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
                <Package className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4">Noch keine Bestellungen vorhanden.</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">Bestellung #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleDateString('de-DE')}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{order.description}</p>
                      <p className="text-sm text-slate-600">User ID: {order.user_id}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800">
                      {order.status || 'offen'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'inquiries' && (
          <div className="space-y-4">
            {inquiries.length === 0 ? (
              <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
                <MessageSquare className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4">Noch keine Anfragen vorhanden.</p>
              </div>
            ) : (
              inquiries.map((inquiry) => (
                <div key={inquiry.id} className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      < h3 className="font-semibold">Anfrage #{inquiry.id.slice(0, 8)}</h3>
                      <p className="text-sm text-slate-600">
                        {new Date(inquiry.created_at).toLocaleDateString('de-DE')}
                      </p>
                      <p className="mt-1 text-sm font-medium">{inquiry.company}</p>
                      <p className="text-sm text-slate-600">{inquiry.contact_person}</p>
                      <p className="text-sm text-slate-600">{inquiry.email}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        <strong>Produkt:</strong> {inquiry.product_type}
                      </p>
                      <p className="text-sm text-slate-600">
                        <strong>Stückzahl:</strong> {inquiry.quantity}
                      </p>
                      {inquiry.deadline && (
                        <p className="text-sm text-slate-600">
                          <strong>Deadline:</strong> {new Date(inquiry.deadline).toLocaleDateString('de-DE')}
                        </p>
                      )}
                      {inquiry.message && (
                        <p className="mt-2 text-sm text-slate-600">
                          <strong>Nachricht:</strong> {inquiry.message}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      <select
                        value={inquiry.status}
                        onChange={(e) => updateInquiryStatus(inquiry.id, e.target.value)}
                        className="rounded-md border border-input px-3 py-1 text-sm"
                      >
                        <option value="neu">Neu</option>
                        <option value="in_bearbeitung">In Bearbeitung</option>
                        <option value="angebot_gesendet">Angebot gesendet</option>
                        <option value="abgeschlossen">Abgeschlossen</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
                <Users className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4">Noch keine Benutzer vorhanden.</p>
              </div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{user.company}</h3>
                      <p className="text-sm text-slate-600">{user.email}</p>
                      <p className="text-sm text-slate-600">
                        Registriert: {new Date(user.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
