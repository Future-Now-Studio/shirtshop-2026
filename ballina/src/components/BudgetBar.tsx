import { cn, formatEUR } from '@/lib/utils'

/** Compact "Jahresbudget" progress bar: spent vs. annual budget (net). */
export function BudgetBar({
  spent,
  budget,
  year,
  className,
}: {
  spent: number
  budget: number
  year: number
  className?: string
}) {
  const ratio = budget > 0 ? spent / budget : 0
  const pct = Math.round(ratio * 100)
  const over = spent > budget
  return (
    <div className={cn('rounded-lg border border-border bg-background px-4 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Jahresbudget {year}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className={cn('font-medium', over ? 'text-destructive' : 'text-foreground')}>
            {formatEUR(spent)}
          </span>{' '}
          von {formatEUR(budget)} netto ({pct} %)
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Jahresbudget ${year} ausgeschöpft`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
      >
        <div
          className={cn('h-full rounded-full', over ? 'bg-destructive' : ratio >= 0.9 ? 'bg-amber-500' : 'bg-brand')}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {over
          ? `Budget um ${formatEUR(spent - budget)} überschritten.`
          : `Noch ${formatEUR(budget - spent)} verfügbar.`}{' '}
        Summe aller nicht stornierten Bestellungen dieses Jahres.
      </p>
    </div>
  )
}
