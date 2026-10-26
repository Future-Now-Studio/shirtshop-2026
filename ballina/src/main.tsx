import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfigError } from './components/ConfigError'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CONFIG_ERROR } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Last line of defence (providers, layout); pages have their own boundary in App. */}
    <ErrorBoundary>{CONFIG_ERROR ? <ConfigError missing={CONFIG_ERROR} /> : <App />}</ErrorBoundary>
  </StrictMode>,
)
