import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

// Capture overlays load only their own small chunk, not the editor and its canvas library.
const isCapture = new URLSearchParams(location.search).has('capture');
const Root = isCapture ? lazy(() => import('./components/CaptureOverlay')) : lazy(() => import('./App'));
createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={null}><Root /></Suspense></StrictMode>);
