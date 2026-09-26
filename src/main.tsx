import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import CaptureOverlay from './components/CaptureOverlay';
import './style.css';

const isCapture = new URLSearchParams(location.search).has('capture');
createRoot(document.getElementById('root')!).render(<React.StrictMode>{isCapture ? <CaptureOverlay /> : <App />}</React.StrictMode>);
