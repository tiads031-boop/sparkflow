import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import AuthGate from './components/AuthGate.tsx'

// Register Service Worker for Web Push + offline cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => registration.update())
    .catch((err) => {
      console.warn('[SW] registration failed:', err.message);
    });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('sparkflow.sw-reloaded') === '1') return;
    sessionStorage.setItem('sparkflow.sw-reloaded', '1');
    window.location.reload();
  });
}

// Global error capture
window.addEventListener('error', (e) => {
  console.error('[window.error]', e.error || e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
)
