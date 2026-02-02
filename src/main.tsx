import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './app/providers'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

// Root renderer entrypoint. AppProviders (incl. ModpackProvider) must wrap App so useModpack is available.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>,
)
