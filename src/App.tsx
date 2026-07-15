import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { IntelligenceReport } from './types'

const AMERICAS_CENTER: L.LatLngExpression = [12, -75]
const CARACAS: L.LatLngExpression = [10.48, -66.9]

type ReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; report: IntelligenceReport }
  | { status: 'error' }

function App() {
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [reportState, setReportState] = useState<ReportState>({ status: 'idle' })

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
      {
        subdomains: 'abcd',
        maxZoom: 20,
      },
    ).addTo(leafletMap)

    const crisisIcon = L.divIcon({
      className: 'crisis-marker-wrap',
      html: '<span class="crisis-marker"><span class="crisis-marker__core"></span></span>',
      iconAnchor: [18, 18],
      iconSize: [36, 36],
    })

    L.marker(CARACAS, { icon: crisisIcon })
      .addTo(leafletMap)
      .bindTooltip('CRISIS // CARACAS', {
        className: 'crisis-tooltip',
        direction: 'top',
        offset: [0, -14],
      })
      .on('click', () => {
        leafletMap.flyTo(CARACAS, 6, { duration: 1.25 })
        setPanelOpen(true)
        setReportState({ status: 'loading' })

        void fetch('/api/llm', { method: 'POST' })
          .then((response) => {
            if (!response.ok) throw new Error('Briefing request failed')
            return response.json() as Promise<IntelligenceReport>
          })
          .then((report) => setReportState({ status: 'ready', report }))
          .catch(() => setReportState({ status: 'error' }))
      })

    map.current = leafletMap

    return () => {
      leafletMap.remove()
      map.current = null
    }
  }, [])

  function closePanel() {
    setPanelOpen(false)
    map.current?.flyTo(AMERICAS_CENTER, 3.25, { duration: 1 })
  }

  return (
    <main className="command-map">
      <div ref={mapElement} className="map-canvas" aria-label="Strategic map" />

      <header className="masthead">
        <div>
          <p className="eyebrow">GLOBAL SITUATION ROOM</p>
          <h1>STATE OF PLAY</h1>
        </div>
        <div className="system-status">
          <span className="status-dot" aria-hidden="true" />
          SYSTEM ONLINE
        </div>
      </header>

      <div className="map-index" aria-hidden="true">
        <span>WESTERN HEMISPHERE</span>
        <span>12.000°N / 75.000°W</span>
      </div>

      <aside
        className={`intel-panel${panelOpen ? ' intel-panel--open' : ''}`}
        aria-hidden={!panelOpen}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">INTELLIGENCE REPORT</p>
            <h2>CARACAS, VENEZUELA</h2>
          </div>
          <button type="button" className="close-button" onClick={closePanel}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close intelligence report</span>
          </button>
        </div>

        <div className="coordinate-strip">
          <span>10.480°N</span>
          <span>66.900°W</span>
          <span className="classification">CLASSIFIED</span>
        </div>

        {reportState.status === 'loading' && (
          <div className="loading-state">
            <span className="loading-line" />
            DECRYPTING FIELD REPORT…
          </div>
        )}

        {reportState.status === 'error' && (
          <p className="error-state">
            Secure channel unavailable. Re-select the crisis marker to retry.
          </p>
        )}

        {reportState.status === 'ready' && (
          <div className="report-content">
            <section>
              <h3>Briefing</h3>
              <p>{reportState.report.briefing}</p>
            </section>
            <section>
              <h3>Threat assessment</h3>
              <p>{reportState.report.threatAssessment}</p>
            </section>
            <section>
              <h3>Response options</h3>
              <ol>
                {reportState.report.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>

      <div className="map-attribution">
        © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ©{' '}
        <a href="https://carto.com/attributions">CARTO</a>
      </div>
    </main>
  )
}

export default App

