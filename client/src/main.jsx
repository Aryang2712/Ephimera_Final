import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Removed <StrictMode> so WebRTC only connects once per tab
createRoot(document.getElementById('root')).render(
    <App />
)