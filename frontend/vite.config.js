import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During `npm run dev`, forward API calls to the Django backend (manage.py runserver 5000).
    proxy: {
      '/scenarios': 'http://localhost:5000',
      '/response': 'http://localhost:5000',
      '/results': 'http://localhost:5000',
      '/insights': 'http://localhost:5000',
      '/admin': 'http://localhost:5000', // scenario designer API (the page itself is at /#/admin)
    },
  },
  // Frontend tests (npm test): run in a simulated browser (jsdom).
  test: {
    environment: 'jsdom',
  },
})
