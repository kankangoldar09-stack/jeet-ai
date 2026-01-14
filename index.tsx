import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical Error: Root element #root not found in DOM.");
    return;
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Jeet AI: React application mounted successfully.");
  } catch (error) {
    console.error("Jeet AI Boot Error:", error);
    rootElement.innerHTML = `<div style="padding: 20px; color: #ff4444; font-family: monospace;">
      <h2>Boot Error</h2>
      <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p>Check console for details.</p>
    </div>`;
  }
};

// Start the app when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}