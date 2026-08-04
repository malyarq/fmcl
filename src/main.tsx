import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './app/providers'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { cacheIPC } from './services/ipc/cacheIPC.ts'
import './index.css'

const restartAfterBootstrapFailure = () => cacheIPC.reload()

// The bootstrap boundary is deliberately outside providers and can only restart the renderer.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary mode="restart" onRestart={restartAfterBootstrapFailure}>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>,
)
