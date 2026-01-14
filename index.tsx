import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const el = document.getElementById('root');
if (el) {
  try {
    const root = ReactDOM.createRoot(el);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Jeet AI: Link Established");
  } catch (err: any) {
    console.error("Mount failed:", err);
    el.innerHTML = `<div style="color:white;padding:20px">Mount Error: ${err.message}</div>`;
  }
}