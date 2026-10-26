import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, Loader2, Search } from 'lucide-react'
import { adminGetCustomer, adminGetCustomersPage } from '@/lib/adminApi'
import { useDebounced } from '@/lib/useDebounced'
import { Label } from '@/components/ui/input'

const RESULT_LIMIT = 20

/**
 * Searchable customer picker for the back-office. Searches server-side
 * (name, Kd-Nr., contact, city) so it scales beyond PostgREST's row cap.
 */
export function CustomerCombobox({
  value,
  onChange,
  label = 'Kunde',
  disabled,
}: {
  value: string
  onChange: (companyId: string) => void
  label?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const search = useDebounced(query.trim(), 250)

  const { data: page, isFetching, isError } = useQuery({
    queryKey: ['admin', 'customers', 'pick', search],
    queryFn: () => adminGetCustomersPage(search, 0, RESULT_LIMIT),
    enabled: open,
    placeholderData: keepPreviousData,
  })
  // Resolve an externally set value (e.g. prefilled from ?kunde=).
  const { data: selected } = useQuery({
    queryKey: ['admin', 'customer', value],
    queryFn: () => adminGetCustomer(value),
    enabled: !!value,
  })

  // Reflect the selected customer's name in the input.
  useEffect(() => {
    if (selected && !query) setQuery(selected.company)
  }, [selected, query])

  const results = page?.rows ?? []
  const more = page?.total != null && page.total > results.length

  return (
    <div className="relative">
      <Label htmlFor="cust-cb">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="cust-cb"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value) onChange('')
          }}
          onFocus={() => setOpen(true)}
          placeholder="Firma oder Kd-Nr. suchen…"
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        {open && isFetching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-lg">
            {isError ? (
              <p className="px-3 py-2 text-sm text-destructive">Kunden konnten nicht geladen werden.</p>
            ) : results.length ? (
              <>
                {results.map((c) => (
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
                ))}
                {more && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Weitere Treffer – bitte Suche verfeinern.
                  </p>
                )}
              </>
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">{page ? 'Kein Treffer' : 'Lädt…'}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
