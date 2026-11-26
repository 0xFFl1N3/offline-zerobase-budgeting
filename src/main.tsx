import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initLanguage } from './i18n/i18n.ts';
import { initTheme } from './theme.ts';

initTheme();
initLanguage();

// Offline support once installed or visited online. Not in development (it would cache files being edited),
// and not for the single-file build opened from disk, which has nothing to fetch.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
