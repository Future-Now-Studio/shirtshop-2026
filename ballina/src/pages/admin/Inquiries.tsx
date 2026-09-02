import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Loader2 } from 'lucide-react'
import { adminGetInquiries, adminSetInquiryStatus } from '@/lib/adminApi'
import type { AdminInquiry } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

const STATUS_LABELS: Record<AdminInquiry['status'], string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  angebot_gesendet: 'Angebot gesendet',
  abgeschlossen: 'Abgeschlossen',
}

export default function Inquiries() {
  const queryClient = useQueryClient()
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['admin', 'inquiries'],
    queryFn: adminGetInquiries,
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminInquiry['status'] }) =>
      adminSetInquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  return (
    <div>
      <PageHeader title="Anfragen" description="Eingehende Großanfragen – prüfen und in ein Angebot überführen." />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : inquiries.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </div>
          <p className="font-medium">Keine offenen Anfragen</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((i) => (
            <Card key={i.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">{i.productType}</span>
                    <Badge variant={i.status === 'neu' ? 'info' : i.status === 'abgeschlossen' ? 'neutral' : 'success'}>
                      {STATUS_LABELS[i.status] ?? i.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{i.companyName}</span>
                    <span className="text-muted-foreground">
                      {' '}· {i.contactPerson} · {formatDate(i.createdAt)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {i.quantity} Stück
                    {i.deadline ? ` · bis ${formatDate(i.deadline)}` : ''}
                    {i.message ? ` · „${i.message}"` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {i.status !== 'abgeschlossen' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus.mutate({ id: i.id, status: 'abgeschlossen' })}
                      disabled={setStatus.isPending}
                    >
                      <Check className="size-4" />
                      Als erledigt
                    </Button>
                  )}
                  <Link to={`/admin/angebote/neu?anfrage=${i.id}`}>
                    <Button variant="brand" size="sm">
                      Angebot erstellen
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
