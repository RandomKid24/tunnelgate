import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toast';
import { initTheme } from './hooks/useTheme';
import './index.css';

// Apply the stored theme (light / dark / system) before the first paint so the window
// never flashes the wrong colours. befui keys off the `dark` class on <html>.
initTheme();

const captureRendererException = (error: unknown): void => {
  void window.pq?.captureException(error).catch(() => undefined);
};

window.addEventListener('error', (event) => {
  captureRendererException(event.error ?? new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  captureRendererException(event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster />
  </React.StrictMode>
);
