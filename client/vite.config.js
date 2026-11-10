import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Any request from React to /api/... is forwarded to the Express server,
    // so the frontend can just call fetch('/api/ingredients').
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
