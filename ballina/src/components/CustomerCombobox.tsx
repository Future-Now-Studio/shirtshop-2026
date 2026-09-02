import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { adminGetCustomers } from '@/lib/adminApi'
import { Label } from '@/components/ui/input'

/** Searchable customer picker for the back-office (scales to many customers). */
export function CustomerCombobox({
  value,
  onChange,
  label = 'Kunde',
}: {
  value: string
  onChange: (companyId: string) => void
  label?: string
}) {
  const { data: customers = [] } = useQuery({ queryKey: ['admin', 'customers'], queryFn: adminGetCustomers })
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = customers.find((c) => c.id === value)

  // Reflect an externally set value (e.g. prefilled from a query param).
  useEffect(() => {
    if (selected && !query) setQuery(selected.company)
  }, [selected, query])

  const term = query.trim().toLowerCase()
  const filtered = customers.filter(
    (c) =>
      c.company.toLowerCase().includes(term) ||
      (c.customerNumber ?? '').toLowerCase().includes(term),
  )

  return (
    <div className="relative">
      <Label htmlFor="cust-cb">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="cust-cb"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value) onChange('')
          }}
          onFocus={() => setOpen(true)}
          placeholder="Kunde suchen…"
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-lg">
            {filtered.length ? (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id)
                    setQuery(c.company)
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">
                    {c.company}
                    {value === c.id && <Check className="ml-1 inline size-3.5 text-brand" />}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.customerNumber}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">Kein Treffer</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
