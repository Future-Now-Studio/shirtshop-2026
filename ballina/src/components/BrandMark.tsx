import { cn } from '@/lib/utils'

/** Ballina logo. Pass `invert` to render it white on dark backgrounds. */
export function BrandMark({ className, invert }: { className?: string; invert?: boolean }) {
  return (
    <img
      src="/logo.svg"
      alt="Ballina"
      className={cn('h-9 w-auto select-none', invert && 'invert', className)}
      draggable={false}
    />
  )
}
