import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'process.env.VITE_SERVER_URL': JSON.stringify(env.VITE_SERVER_URL)
    }
  }
}) 