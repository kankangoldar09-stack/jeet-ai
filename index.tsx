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
        console.log("Jeet AI: Initialized");
    } catch (err) {
        console.error("Initialization Failed:", err);
        container.innerHTML = `<div style="color:white;padding:20px;font-family:sans-serif">
            <h2>Critical Error</h2>
            <p>${err.message}</p>
        </div>`;
    }
}