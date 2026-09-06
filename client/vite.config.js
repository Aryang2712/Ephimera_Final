import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Allows Cloudflare tunnels
    allowedHosts: ['.trycloudflare.com'],
    // Exposes the server to your local network
    host: true, 
    // Forces Vite to send CSS over Cloudflare's secure HTTPS port
    hmr: {
      clientPort: 443 
    }
  }
})