import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import Quotes from '@/pages/Quotes'
import Inquiry from '@/pages/Inquiry'
import MyInquiries from '@/pages/MyInquiries'

type Tab = 'angebote' | 'anfragen' | 'anfrage'

const TABS: [Tab, string][] = [
  ['angebote', 'Angebote'],
  ['anfragen', 'Meine Anfragen'],
  ['anfrage', 'Neue Anfrage'],
]

/** Combined "Angebote & Anfragen" area — the customer touchpoints for quotes. */
export default function Angebote() {
  // The tab lives in the URL (?tab=…) so links and the back button work.
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'anfrage' || raw === 'anfragen' ? raw : 'angebote'
  const setTab = (t: Tab) => setParams(t === 'angebote' ? {} : { tab: t }, { replace: true })

  return (
    <div>
      <PageHeader
        title="Angebote & Anfragen"
        description="Angebote prüfen und annehmen, den Stand Ihrer Anfragen verfolgen oder eine neue Anfrage stellen."
      />

      <div className="mb-6 inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-1" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'angebote' && <Quotes embedded />}
      {tab === 'anfragen' && <MyInquiries onNew={() => setTab('anfrage')} />}
      {tab === 'anfrage' && <Inquiry embedded onShowInquiries={() => setTab('anfragen')} />}
    </div>
  )
}
