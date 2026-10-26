import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

// A lazily loaded page chunk that no longer exists (new deploy while the tab was open).
const CHUNK_ERROR = /dynamically imported module|Failed to fetch|Importing a module script failed|error loading dynamically/i

interface Props {
  children: ReactNode
  /** Changing this value (e.g. the route) resets the error state. */
  resetKey?: string
}

interface State {
  error: Error | null
  resetKey?: string
}

/**
 * Catches render errors so a single broken page shows a message with a way
 * out instead of a blank white screen. Errors are logged to the console
 * (hook for an error tracker such as Sentry later).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  // Navigating elsewhere (new resetKey) clears a previous error.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[portal] render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const outdated = CHUNK_ERROR.test(error.message)
    return (
      <div role="alert" className="grid min-h-[50vh] place-items-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">
            {outdated ? 'Das Portal wurde aktualisiert' : 'Hier ist etwas schiefgelaufen'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {outdated
              ? 'Bitte laden Sie die Seite neu, um die aktuelle Version zu verwenden.'
              : 'Die Seite konnte nicht angezeigt werden. Bitte laden Sie sie neu. Ihre Bestellungen und Daten sind davon nicht betroffen.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground hover:bg-brand/90"
            >
              Seite neu laden
            </button>
            {/* /login forwards signed-in users to their start page (portal or back office). */}
            <a
              href="/login"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-muted"
            >
              Zur Übersicht
            </a>
          </div>
        </div>
      </div>
    )
  }
}

/** ErrorBoundary that resets when the user navigates to another page. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}
