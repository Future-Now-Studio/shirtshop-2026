import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send } from 'lucide-react'

export default function BulkOrder() {
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [deadline, setDeadline] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      // Create inquiry
      const { error: inquiryError } = await supabase
        .from('b2b_inquiries')
        .insert({
          user_id: user.id,
          company,
          contact_person: contact,
          email,
          phone,
          product_type: product,
          quantity: parseInt(quantity),
          deadline,
          message,
          status: 'neu',
        })

      if (inquiryError) throw inquiryError

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Anfrage fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-5 w-5" />
            <span>Zurück zum Dashboard</span>
          </Link>
          <span className="text-xl font-bold text-slate-900">Ballina</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Großbestellung anfragen</h1>
            <p className="mt-2 text-slate-600">
              Füllen Sie das Formular aus und wir melden uns schnellstmöglich bei Ihnen.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Unternehmensinformationen</h3>
                <div>
                  <label htmlFor="company" className="mb-2 block text-sm font-medium">
                    Unternehmen *
                  </label>
                  <input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="Ihr Unternehmen"
                  />
                </div>
                <div>
                  <label htmlFor="contact" className="mb-2 block text-sm font-medium">
                    Ansprechpartner *
                  </label>
                  <input
                    id="contact"
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="Ihr Name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium">
                      E-Mail *
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-md border border-input px-3 py-2 text-sm"
                      placeholder="ihre@email.de"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-medium">
                      Telefon
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-md border border-input px-3 py-2 text-sm"
                      placeholder="+49 123 456789"
                    />
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Bestelldetails</h3>
                <div>
                  <label htmlFor="product" className="mb-2 block text-sm font-medium">
                    Produkttyp *
                  </label>
                  <input
                    id="product"
                    type="text"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    required
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="z.B. T-Shirts, Hoodies, Polos"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="quantity" className="mb-2 block text-sm font-medium">
                      Stückzahl *
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                      min="1"
                      className="w-full rounded-md border border-input px-3 py-2 text-sm"
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label htmlFor="deadline" className="mb-2 block text-sm font-medium">
                      Gewünschtes Lieferdatum
                    </label>
                    <input
                      id="deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-medium">
                  Nachricht / Anforderungen
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Beschreiben Sie Ihre Anforderungen (Größen, Farben, Druckdetails, etc.)"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <Send className="h-4 w-4" />
                {loading ? 'Wird gesendet...' : 'Anfrage senden'}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
