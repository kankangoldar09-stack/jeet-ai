import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const init = () => {
    const container = document.getElementById('root');
    if (!container) return;
    
    try {
        const root = ReactDOM.createRoot(container);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
        console.log("Jeet AI: Neural Link Established");
    } catch (e) {
        console.error("Mounting failed:", e);
        container.innerHTML = `<div style="color:red; padding:20px;">Mounting Error: ${e.message}</div>`;
    }
};

if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}