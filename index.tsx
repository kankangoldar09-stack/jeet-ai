import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const mount = () => {
    const el = document.getElementById('root');
    if (!el) return;

    try {
        const root = ReactDOM.createRoot(el);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
        console.log("Jeet AI: Neural link initialized.");
    } catch (err: any) {
        console.error("Mount failed:", err);
        el.innerHTML = `
            <div style="color:white; padding:40px; font-family:sans-serif; background:black; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <h2 style="color:#6366f1;">BOOT ERROR</h2>
                <p style="opacity:0.5; font-size:14px; margin-top:10px;">${err.message}</p>
            </div>
        `;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
} else {
    mount();
}