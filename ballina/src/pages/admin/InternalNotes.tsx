import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock } from 'lucide-react'
import { adminAddNote, adminGetNotes, type NoteTarget } from '@/lib/adminApi'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function when(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * "Interne Notizen" card (order or customer). Notes live in admin-only tables
 * (migration 013) and are never shown in the customer portal.
 */
export function InternalNotes({ target, className }: { target: NoteTarget; className?: string }) {
  const queryClient = useQueryClient()
  const key = ['admin', 'notes', 'orderId' in target ? `o:${target.orderId}` : `c:${target.companyId}`]
  const { data: notes = [], isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: () => adminGetNotes(target),
  })
  const [body, setBody] = useState('')
  const add = useMutation({
    mutationFn: () => adminAddNote(target, body),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return (
    <Card className={cn('p-5', className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Lock className="size-3.5" /> Interne Notizen
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Nur für das Backoffice sichtbar – nie für den Kunden.</p>

      <div className="mt-3 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="z. B. Druckhinweise, Absprachen, Zahlungsverhalten…"
          maxLength={4000}
          aria-label="Neue interne Notiz"
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => add.mutate()} disabled={!body.trim() || add.isPending}>
            {add.isPending && <Loader2 className="size-4 animate-spin" />}
            Notiz speichern
          </Button>
          {add.isError && (
            <span role="alert" className="text-xs text-destructive">{(add.error as Error).message}</span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Notizen konnten nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
          </p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Notizen.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="border-l-2 border-border pl-3">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{when(n.createdAt)}</span>
                {n.authorEmail && <span>· {n.authorEmail}</span>}
                {n.kind === 'reklamation' && <Badge variant="destructive">Reklamation</Badge>}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-sm">{n.body}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
