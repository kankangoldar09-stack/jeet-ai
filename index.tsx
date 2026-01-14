import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (container) {
  try {
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Jeet AI: Neural Interface Initialized");
  } catch (err: any) {
    console.error("Critical Mount Failure:", err);
    container.innerHTML = `
      <div style="background:black; color:white; height:100vh; display:flex; align-items:center; justify-content:center; font-family:sans-serif;">
        <div style="text-align:center;">
          <h2 style="color:#6366f1;">BOOT FAILURE</h2>
          <p style="opacity:0.5; font-size:12px;">${err.message}</p>
        </div>
      </div>
    `;
  }
}