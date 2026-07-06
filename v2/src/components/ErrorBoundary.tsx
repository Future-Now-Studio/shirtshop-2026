import { Component, type ReactNode } from "react";

interface State { hasError: boolean; message?: string }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-bold lowercase">etwas ist schiefgelaufen</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            bitte lade die seite neu. besteht das problem weiter, melde dich bei uns.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground"
          >
            neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
