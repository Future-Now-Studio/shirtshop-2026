import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2 } from 'lucide-react'
import { adminGetInquiries } from '@/lib/adminApi'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function Inquiries() {
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['admin', 'inquiries'],
    queryFn: adminGetInquiries,
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
                    <Badge variant={i.status === 'neu' ? 'info' : 'neutral'}>
                      {i.status === 'neu' ? 'Neu' : 'In Bearbeitung'}
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
                <Link to={`/admin/angebote/neu?anfrage=${i.id}`}>
                  <Button variant="brand" size="sm">
                    Angebot erstellen
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
