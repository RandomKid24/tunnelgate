import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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
    <App />
  </React.StrictMode>
);
