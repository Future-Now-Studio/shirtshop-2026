import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/types'
import { ORDER_STATUS_LABELS } from '@/lib/types'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        brand: 'bg-brand-muted text-brand',
        success: 'bg-success/12 text-success',
        warning: 'bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_28%)]',
        info: 'bg-primary/10 text-primary',
        destructive: 'bg-destructive/12 text-destructive',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const STATUS_VARIANT: Record<OrderStatus, VariantProps<typeof badgeVariants>['variant']> = {
  offen: 'info',
  in_bearbeitung: 'warning',
  versendet: 'brand',
  abgeschlossen: 'success',
  storniert: 'destructive',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <span className="size-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}
