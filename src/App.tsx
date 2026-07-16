import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import L from 'leaflet'
import { playCrisisStinger, setAmbientEnabled } from './audio'
import { IntelPanel } from './components/IntelPanel'
import { PerspectiveTransition } from './components/PerspectiveTransition'
import { TerminalChrome } from './components/TerminalChrome'
import { TypewriterText } from './components/TypewriterText'
import { createCrisisIcon } from './lib/crisisMarker'
import { createNationPromptContext } from './game/nations'
import { useGameState } from './state/GameState'
import type { BriefingRequest, Crisis, IntelligenceReport } from './types'

const AMERICAS_CENTER: L.LatLngExpression = [12, -75]

const ACTIVE_CRISIS: Crisis = {
  id: 'ven-caracas-01',
  title: 'FLASHPOINT: CARACAS',
  location: 'Caracas, Venezuela',
  coordinates: [10.48, -66.9],
  type: 'military',
  intelFragment: 'CLASSIFIED // Irregular force movement detected near the capital.',
}

type ReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; report: IntelligenceReport }
  | { status: 'error' }

type AmbientBlip = {
  id: number
  x: number
  y: number
}

function App() {
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [ambientEnabled, setAmbientOn] = useState(false)
  const [reportState, setReportState] = useState<ReportState>({ status: 'idle' })
  const [transmissionComplete, setTransmissionComplete] = useState(false)
  const [perspectiveWipe, setPerspectiveWipe] = useState(false)
  const [ambientBlips, setAmbientBlips] = useState<AmbientBlip[]>([])
  const { activeNation, activeWorldState } = useGameState()

  const selectCrisis = useCallback((crisis: Crisis) => {
    map.current?.flyTo(crisis.coordinates, 6, { duration: 1.25 })
    playCrisisStinger(crisis.type)
    setPanelOpen(true)
    setTransmissionComplete(false)
    setReportState({ status: 'loading' })

    const briefingRequest: BriefingRequest = {
      crisis,
      perspective: createNationPromptContext(
        activeNation.id,
        activeWorldState.meters,
      ),
    }

    void fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(briefingRequest),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Briefing request failed')
        return response.json() as Promise<IntelligenceReport>
      })
      .then((report) => setReportState({ status: 'ready', report }))
      .catch(() => setReportState({ status: 'error' }))
  }, [activeNation.id, activeWorldState.meters])

  useEffect(() => {
    if (!mapElement.current || map.current) return

    const leafletMap = L.map(mapElement.current, {
      attributionControl: false,
      center: AMERICAS_CENTER,
      zoom: 3.25,
      zoomControl: false,
      zoomSnap: 0.25,
      minZoom: 2,
    })

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 20 },
    ).addTo(leafletMap)

    L.marker(ACTIVE_CRISIS.coordinates, {
      icon: createCrisisIcon(ACTIVE_CRISIS.type),
      keyboard: true,
      title: ACTIVE_CRISIS.title,
    })
      .addTo(leafletMap)
      .bindTooltip(ACTIVE_CRISIS.intelFragment, {
        className: `crisis-tooltip crisis-tooltip--${ACTIVE_CRISIS.type}`,
        direction: 'right',
        offset: [19, 0],
      })
      .on('click', () => selectCrisis(ACTIVE_CRISIS))

    map.current = leafletMap

    return () => {
      leafletMap.remove()
      map.current = null
    }
  }, [selectCrisis])

  useEffect(() => {
    if (panelOpen) return

    const spawnBlip = () => {
      const id = Date.now()
      setAmbientBlips((current) => [
        ...current.slice(-2),
        { id, x: 18 + Math.random() * 64, y: 22 + Math.random() * 54 },
      ])
      window.setTimeout(
        () => setAmbientBlips((current) => current.filter((blip) => blip.id !== id)),
        2800,
      )
    }

    const initial = window.setTimeout(spawnBlip, 1800)
    const interval = window.setInterval(spawnBlip, 6200)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [panelOpen])

  useEffect(() => () => setAmbientEnabled(false), [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setTransmissionComplete(false)
    map.current?.flyTo(AMERICAS_CENTER, 3.25, { duration: 1 })
  }, [])

  const completeTransmission = useCallback(() => setTransmissionComplete(true), [])

  function toggleAmbient() {
    const next = !ambientEnabled
    setAmbientOn(next)
    setAmbientEnabled(next)
  }

  function testPerspectiveWipe() {
    if (perspectiveWipe) return
    setPerspectiveWipe(true)
    window.setTimeout(() => setPerspectiveWipe(false), 1550)
  }

  return (
    <main className="command-map">
      <div ref={mapElement} className="map-canvas" aria-label="Strategic map" />

      <div className="map-graticule" aria-hidden="true" />
      <div className="radar-sweep" aria-hidden="true" />
      <div className="ambient-signals" aria-hidden="true">
        {ambientBlips.map((blip) => (
          <span
            className="signal-blip"
            key={blip.id}
            style={{ left: `${blip.x}%`, top: `${blip.y}%` }}
          >
            <i />
            SIGNAL DETECTED
          </span>
        ))}
      </div>

      <TerminalChrome
        ambientEnabled={ambientEnabled}
        onAmbientToggle={toggleAmbient}
      />

      <div className="map-letterhead" aria-hidden="true">
        <span>STATE OF PLAY</span>
        <small>WESTERN HEMISPHERE // LIVE THEATER</small>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <IntelPanel
            eyebrow="PRIORITY INTELLIGENCE"
            mode="briefing"
            onClose={closePanel}
            title={ACTIVE_CRISIS.title}
          >
            {reportState.status === 'loading' && (
              <div className="loading-state">
                <span className="loading-line" />
                DECRYPTING FIELD REPORT…
              </div>
            )}

            {reportState.status === 'error' && (
              <p className="error-state">
                SECURE CHANNEL UNAVAILABLE. RESELECT CRISIS VECTOR TO RETRY.
              </p>
            )}

            {reportState.status === 'ready' && (
              <div className="report-content">
                <section>
                  <h3>01 // Situation briefing</h3>
                  <TypewriterText
                    text={reportState.report.briefing}
                    onComplete={completeTransmission}
                  />
                </section>

                <AnimatePresence>
                  {transmissionComplete && (
                    <m.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                    >
                      <section>
                        <h3>02 // Threat assessment</h3>
                        <p>{reportState.report.threatAssessment}</p>
                      </section>
                      <section>
                        <h3>03 // Advisory channel</h3>
                        <div className="advisor-grid">
                          {reportState.report.advisors.map((advisor) => (
                            <article className="advisor-line" key={advisor.role}>
                              <div>
                                <strong>{advisor.role}</strong>
                                <span>{advisor.stance}</span>
                              </div>
                              <p>“{advisor.line}”</p>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section>
                        <h3>04 // Response vectors</h3>
                        <ol>
                          {reportState.report.options.map((option) => (
                            <li key={option}>{option}</li>
                          ))}
                        </ol>
                      </section>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </IntelPanel>
        )}
      </AnimatePresence>

      <m.nav
        className="crisis-dock hud-frame"
        aria-label="Active crises"
        initial={{ opacity: 0, y: 18, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ delay: 0.18, duration: 0.34 }}
      >
        <span className="dock-label">ACTIVE CRISES // 01</span>
        <button type="button" onClick={() => selectCrisis(ACTIVE_CRISIS)}>
          <i className={`dock-threat dock-threat--${ACTIVE_CRISIS.type}`} />
          <span>
            <strong>{ACTIVE_CRISIS.location}</strong>
            {ACTIVE_CRISIS.type.toUpperCase()} // PRIORITY
          </span>
        </button>
      </m.nav>

      <button type="button" className="perspective-test" onClick={testPerspectiveWipe}>
        TEST // PERSPECTIVE FLIP
      </button>

      <div className="map-attribution">
        © <a href="https://www.openstreetmap.org/copyright">OSM</a> ©{' '}
        <a href="https://carto.com/attributions">CARTO</a>
      </div>

      <div className="film-grain" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <AnimatePresence>
        {perspectiveWipe && (
          <PerspectiveTransition targetLetterhead="DIRECTORATE // ALPHA" />
        )}
      </AnimatePresence>
    </main>
  )
}

export default App
