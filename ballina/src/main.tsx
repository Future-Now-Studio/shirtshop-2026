import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfigError } from './components/ConfigError'
import { CONFIG_ERROR } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {CONFIG_ERROR ? <ConfigError missing={CONFIG_ERROR} /> : <App />}
  </StrictMode>,
)
