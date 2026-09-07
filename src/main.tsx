import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

document.getElementById('prerender')?.remove();
document.getElementById('prerender-style')?.remove();
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);

