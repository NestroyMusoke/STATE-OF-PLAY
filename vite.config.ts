import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import llmHandler from './api/llm'
import newsHandler from './api/news'
import consequenceHandler from './api/consequence'

/**
 * Vercel mounts files in /api automatically. Vite does not, so this tiny adapter
 * runs the exact same handler during local development without a second server.
 */
function localApiPlugin(): Plugin {
  return {
    name: 'state-of-play-local-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', (request, response) => {
        void llmHandler(request, response)
      })
      server.middlewares.use('/api/news', (request, response) => {
        void newsHandler(request, response)
      })
      server.middlewares.use('/api/consequence', (request, response) => {
        void consequenceHandler(request, response)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
})
