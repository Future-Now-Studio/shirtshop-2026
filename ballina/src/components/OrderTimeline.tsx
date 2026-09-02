import { Check } from 'lucide-react'
import type { Order, StatusEvent } from '@/lib/types'
import { ORDER_FLOW, ORDER_STATUS_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// #7 Status-Tracking timeline: shows the fixed pipeline with reached steps filled.
export function OrderTimeline({ order }: { order: Order }) {
  const history = order.statusHistory ?? [{ status: order.status, at: order.createdAt }]
  const eventFor = (status: string): StatusEvent | undefined =>
    history.find((e) => e.status === status)

  if (order.status === 'storniert') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span className="size-2 rounded-full bg-destructive" />
        Storniert am {formatDateTime(history.at(-1)?.at ?? order.createdAt)}
      </div>
    )
  }

  const reachedIdx = ORDER_FLOW.reduce(
    (max, s, i) => (eventFor(s) ? i : max),
    0,
  )

  return (
    <ol className="space-y-0">
      {ORDER_FLOW.map((status, i) => {
        const ev = eventFor(status)
        const done = i <= reachedIdx
        const current = i === reachedIdx
        const last = i === ORDER_FLOW.length - 1
        return (
          <li key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors',
                  done
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              {!last && (
                <span className={cn('w-0.5 flex-1 min-h-8', i < reachedIdx ? 'bg-brand' : 'bg-border')} />
              )}
            </div>
            <div className={cn('pb-6', last && 'pb-0')}>
              <p className={cn('text-sm font-medium', current && 'text-brand', !done && 'text-muted-foreground')}>
                {ORDER_STATUS_LABELS[status]}
              </p>
              {ev && (
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(ev.at)}
                  {ev.note ? ` · ${ev.note}` : ''}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
