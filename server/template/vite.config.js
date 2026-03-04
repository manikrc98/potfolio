import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/__REPO_NAME__/',
  plugins: [react()],
})
