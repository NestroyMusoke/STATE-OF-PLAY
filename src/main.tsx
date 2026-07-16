import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { domAnimation, LazyMotion } from 'framer-motion'
import 'leaflet/dist/leaflet.css'
import './styles/tokens.css'
import './styles.css'
import App from './App'
import { GameStateProvider } from './state/GameState'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <GameStateProvider>
        <App />
      </GameStateProvider>
    </LazyMotion>
  </StrictMode>,
)
