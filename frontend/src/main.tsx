import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function installTelegramFormReset() {
  if (typeof document === 'undefined' || document.getElementById('telegram-form-reset')) return;

  const style = document.createElement('style');
  style.id = 'telegram-form-reset';
  style.textContent = `
    input.input,
    textarea.input,
    select.input,
    .select {
      background: #151515 !important;
      background-color: #151515 !important;
      background-image: none !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      border-color: #2a2a2a !important;
      -webkit-appearance: none !important;
      appearance: none !important;
      -webkit-box-shadow: 0 0 0 1000px #151515 inset !important;
      box-shadow: 0 0 0 1000px #151515 inset !important;
    }

    .admin-qty-control input.input {
      background: #101011 !important;
      background-color: #101011 !important;
      background-image: none !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      border-color: #2a2a2a !important;
      -webkit-appearance: none !important;
      appearance: none !important;
      -webkit-box-shadow: 0 0 0 1000px #101011 inset !important;
      box-shadow: 0 0 0 1000px #101011 inset !important;
    }
  `;
  document.head.appendChild(style);
}

installTelegramFormReset();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
