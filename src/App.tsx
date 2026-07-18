import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import L from 'leaflet'
import { playCrisisStinger, setAmbientEnabled } from './audio'
import { IntelPanel } from './components/IntelPanel'
import { PerspectiveTransition } from './components/PerspectiveTransition'
import { TerminalChrome } from './components/TerminalChrome'
import { TypewriterText } from './components/TypewriterText'
import { createCrisisIcon } from './lib/crisisMarker'
import { headlinesToCrises } from './lib/headlineCrisis'
import { createNationPromptContext, NATIONS } from './game/nations'
import { useGameState } from './state/GameState'
import seedHeadlineData from './data/seedHeadlines.json'
import type {
  BriefingRequest,
  BriefingPriorContext,
  ConsequenceRequest,
  ConsequenceResponse,
  Crisis,
  DecisionRecord,
  Headline,
  IntelligenceReport,
  NationId,
} from './types'

const AMERICAS_CENTER: L.LatLngExpression = [12, -75]

const SEED_HEADLINES = seedHeadlineData as Headline[]
const ACTIVE_CRISIS_CAP = 3
const SEED_CRISES = headlinesToCrises(SEED_HEADLINES).slice(
  0,
  ACTIVE_CRISIS_CAP,
)

function safeFallbackConsequence(
  chosenOption: string,
  nationId: NationId,
): ConsequenceResponse {
  const isVenezuela = nationId === 'venezuela'
  return {
    narrative: `The government executes ${chosenOption.replace(/[.!?]+$/, '')}. Initial reporting shows limited movement while agencies assess second-order effects.`,
    deltas: {
      approval: isVenezuela ? 0 : 1,
      treasury: isVenezuela ? 0 : -1,
      legitimacy: isVenezuela ? 0 : 1,
      tension: 0,
      sovereignty: isVenezuela ? 1 : 0,
      morale: isVenezuela ? 1 : 0,
      reconstruction: isVenezuela ? -1 : 0,
      foreignSupport: isVenezuela ? 1 : 0,
    },
  }
}

function followOnCrisis(
  report: IntelligenceReport,
  parent: Crisis,
  id: string,
): Crisis {
  return {
    id,
    title: `FOLLOW-ON // ${parent.location.toUpperCase()}`,
    location: parent.location,
    coordinates: [
      Math.max(-80, Math.min(80, parent.coordinates[0] + 0.42)),
      parent.coordinates[1] + 0.48,
    ],
    type: parent.type,
    intelFragment: `CLASSIFIED // ${report.threatAssessment}`,
  }
}

function callbackEffect(chosenOption: string) {
  if (/lift|ease|relief|aid|cooperat|diplomat|channel|accept/i.test(chosenOption)) {
    return {
      calloutEffect:
        'reconstruction access improves, but the street questions whether Caracas traded sovereignty for Washington’s support.',
      deltas: { sovereignty: -5, morale: -6, reconstruction: 10, foreignSupport: 6 },
    }
  }

  if (/sanction|pressure|force|strike|blockade|mobiliz|intervention/i.test(chosenOption)) {
    return {
      calloutEffect:
        'external pressure hardens public resistance while constraining reconstruction and household confidence.',
      deltas: { sovereignty: 6, morale: -5, reconstruction: -8, foreignSupport: 2 },
    }
  }

  return {
    calloutEffect:
      'Washington’s posture creates limited diplomatic room, but uncertainty weighs on public confidence in Caracas.',
    deltas: { sovereignty: -2, morale: -3, reconstruction: 3, foreignSupport: 3 },
  }
}

function buildUsPriorContext(
  history: DecisionRecord[],
): BriefingPriorContext | undefined {
  const usDecisions = history
    .filter((decision) => decision.nationId === 'united-states')
    .slice(-6)
  const latestDecision = usDecisions.at(-1)
  if (!latestDecision) return undefined

  const { calloutEffect } = callbackEffect(latestDecision.chosenOption)
  return {
    sourceNationId: 'united-states',
    triggeringDecisionId: latestDecision.id,
    summary: usDecisions
      .map(
        (decision) =>
          `US turn ${decision.turn}: chose “${decision.chosenOption}”. Result: ${decision.narrative}`,
      )
      .join(' '),
    causalityCallout: `Because the US chose “${latestDecision.chosenOption}”, ${calloutEffect}`,
  }
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
  const crisisLayer = useRef<L.LayerGroup | null>(null)
  const preloadedReports = useRef(new Map<string, IntelligenceReport>())
  const briefingRequestSequence = useRef(0)
  const reloadAfterNationSwitch = useRef(false)
  const perspectiveTimers = useRef<number[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [ambientEnabled, setAmbientOn] = useState(false)
  const [reportState, setReportState] = useState<ReportState>({ status: 'idle' })
  const [transmissionComplete, setTransmissionComplete] = useState(false)
  const [perspectiveWipe, setPerspectiveWipe] = useState(false)
  const [perspectiveTarget, setPerspectiveTarget] = useState<NationId | null>(
    null,
  )
  const [ambientBlips, setAmbientBlips] = useState<AmbientBlip[]>([])
  const [crises, setCrises] = useState<Crisis[]>(SEED_CRISES)
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null)
  const [fallbackMode, setFallbackMode] = useState(true)
  const [transmittingOption, setTransmittingOption] = useState<string | null>(
    null,
  )
  const { state, activeNation, activeWorldState, dispatch } = useGameState()

  const loadBriefing = useCallback((crisis: Crisis) => {
    const requestSequence = ++briefingRequestSequence.current
    setTransmissionComplete(false)
    setReportState({ status: 'loading' })

    const reportKey = `${activeNation.id}:${crisis.id}`
    const preloadedReport = preloadedReports.current.get(reportKey)
    if (preloadedReport) {
      setReportState({ status: 'ready', report: preloadedReport })
      return
    }

    const briefingRequest: BriefingRequest = {
      crisis,
      headlineId: crisis.id,
      perspective: createNationPromptContext(
        activeNation.id,
        activeWorldState.meters,
      ),
      priorContext:
        activeNation.id === 'venezuela'
          ? buildUsPriorContext(state.history)
          : undefined,
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
      .then((report) => {
        if (briefingRequestSequence.current !== requestSequence) return
        setReportState({ status: 'ready', report })
      })
      .catch(() => {
        if (briefingRequestSequence.current !== requestSequence) return
        setReportState({ status: 'error' })
      })
  }, [activeNation.id, activeWorldState.meters, state.history])

  const selectCrisis = useCallback((crisis: Crisis) => {
    map.current?.flyTo(crisis.coordinates, 6, { duration: 1.25 })
    playCrisisStinger(crisis.type)
    setSelectedCrisis(crisis)
    setPanelOpen(true)
    loadBriefing(crisis)
  }, [loadBriefing])

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

    crisisLayer.current = L.layerGroup().addTo(leafletMap)
    map.current = leafletMap

    return () => {
      leafletMap.remove()
      crisisLayer.current = null
      map.current = null
    }
  }, [])

  useEffect(() => {
    const layer = crisisLayer.current
    if (!layer) return

    layer.clearLayers()
    crises.forEach((crisis) => {
      L.marker(crisis.coordinates, {
        icon: createCrisisIcon(crisis.type),
        keyboard: true,
        title: crisis.title,
      })
        .addTo(layer)
        .bindTooltip(crisis.intelFragment, {
          className: `crisis-tooltip crisis-tooltip--${crisis.type}`,
          direction: 'right',
          offset: [19, 0],
        })
        .on('click', () => selectCrisis(crisis))
    })
  }, [crises, selectCrisis])

  useEffect(() => {
    let cancelled = false

    void fetch('/api/news')
      .then(async (response) => {
        if (!response.ok) throw new Error('Headline request failed')
        const aiMode = response.headers.get('X-State-Of-Play-AI-Mode')
        const headlines = (await response.json()) as Headline[]
        if (!Array.isArray(headlines) || headlines.length === 0) {
          throw new Error('Headline response was empty')
        }
        if (!cancelled) {
          setFallbackMode(aiMode !== 'live')
          setCrises(
            headlinesToCrises(headlines).slice(0, ACTIVE_CRISIS_CAP),
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackMode(true)
          setCrises(SEED_CRISES)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

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

  useEffect(
    () => () => {
      setAmbientEnabled(false)
      perspectiveTimers.current.forEach((timer) => window.clearTimeout(timer))
    },
    [],
  )

  useEffect(() => {
    if (!reloadAfterNationSwitch.current) return
    reloadAfterNationSwitch.current = false

    const nationCrisis = selectedCrisis ?? crises[0]
    if (!nationCrisis) return

    setSelectedCrisis(nationCrisis)
    setPanelOpen(true)
    setTransmittingOption(null)
    map.current?.flyTo(nationCrisis.coordinates, 6, { duration: 1.4 })
    loadBriefing(nationCrisis)
  }, [activeNation.id, crises, loadBriefing, selectedCrisis])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setTransmissionComplete(false)
    map.current?.flyTo(AMERICAS_CENTER, 3.25, { duration: 1 })
  }, [])

  const completeTransmission = useCallback(() => setTransmissionComplete(true), [])

  async function executeDecision(chosenOption: string) {
    if (!selectedCrisis || transmittingOption) return

    setTransmittingOption(chosenOption)
    const perspective = createNationPromptContext(
      activeNation.id,
      activeWorldState.meters,
    )
    const request: ConsequenceRequest = {
      crisis: selectedCrisis,
      headlineId: selectedCrisis.id,
      chosenOption,
      perspective,
      worldState: {
        turn: activeWorldState.turn,
        meters: activeWorldState.meters,
        recentDecisions: state.history.slice(-6),
      },
    }

    let consequence = safeFallbackConsequence(chosenOption, activeNation.id)

    try {
      const response = await fetch('/api/consequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!response.ok) throw new Error('Consequence request failed')

      const payload = (await response.json()) as ConsequenceResponse
      if (
        typeof payload.narrative !== 'string' ||
        typeof payload.deltas !== 'object' ||
        payload.deltas === null
      ) {
        throw new Error('Consequence response was invalid')
      }
      consequence = payload
    } catch (error) {
      console.warn(
        '[game-loop] Consequence request failed; applying client fallback.',
        error,
      )
    }

    const decisionId =
      globalThis.crypto?.randomUUID?.() ??
      `decision-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const decision: DecisionRecord = {
      id: decisionId,
      nationId: activeNation.id,
      crisisId: selectedCrisis.id,
      crisisTitle: selectedCrisis.title,
      chosenOption,
      narrative: consequence.narrative,
      turn: activeWorldState.turn,
      timestamp: new Date().toISOString(),
      deltas: consequence.deltas,
    }

    dispatch({
      type: 'APPLY_DELTAS',
      nationId: activeNation.id,
      deltas: consequence.deltas,
    })
    dispatch({ type: 'ADVANCE_TURN', nationId: activeNation.id })
    dispatch({ type: 'RECORD_DECISION', decision })

    if (consequence.spawnedCrisis) {
      const spawnedReport = consequence.spawnedCrisis
      const spawnedId = `${selectedCrisis.id}-follow-on-${decisionId}`
      setCrises((current) => {
        if (current.length >= ACTIVE_CRISIS_CAP) return current
        preloadedReports.current.set(
          `${activeNation.id}:${spawnedId}`,
          spawnedReport,
        )
        return [
          ...current,
          followOnCrisis(spawnedReport, selectedCrisis, spawnedId),
        ]
      })
    }

    setTransmittingOption(null)
  }

  function toggleAmbient() {
    const next = !ambientEnabled
    setAmbientOn(next)
    setAmbientEnabled(next)
  }

  function switchPerspective() {
    if (perspectiveWipe || transmittingOption) return

    const targetNationId: NationId =
      activeNation.id === 'united-states' ? 'venezuela' : 'united-states'
    setPerspectiveTarget(targetNationId)
    setPerspectiveWipe(true)

    const switchTimer = window.setTimeout(() => {
      if (targetNationId === 'venezuela') {
        state.history
          .filter((decision) => decision.nationId === 'united-states')
          .forEach((decision) => {
            dispatch({
              type: 'APPLY_CROSS_NATION_CALLBACK',
              decisionId: decision.id,
              deltas: callbackEffect(decision.chosenOption).deltas,
            })
          })
      }
      reloadAfterNationSwitch.current = true
      dispatch({ type: 'SET_ACTIVE_NATION', nationId: targetNationId })
    }, 580)
    const closeTimer = window.setTimeout(() => {
      setPerspectiveWipe(false)
      setPerspectiveTarget(null)
      perspectiveTimers.current = []
    }, 1550)

    perspectiveTimers.current = [switchTimer, closeTimer]
  }

  const nextNation =
    activeNation.id === 'united-states' ? NATIONS.venezuela : NATIONS['united-states']
  const targetNation = perspectiveTarget ? NATIONS[perspectiveTarget] : null
  const causalityContext =
    activeNation.id === 'venezuela'
      ? buildUsPriorContext(state.history)
      : undefined

  return (
    <main className={`command-map command-map--${activeNation.id}`}>
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
        <small>
          {activeNation.seat.toUpperCase()} COMMAND //{' '}
          {activeNation.name.toUpperCase()}
        </small>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <IntelPanel
            eyebrow={`${activeNation.shortName} // PRIORITY INTELLIGENCE`}
            mode="briefing"
            onClose={closePanel}
            title={selectedCrisis?.title ?? 'INTELLIGENCE REPORT'}
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
                {causalityContext && (
                  <aside className="causality-callout">
                    <span>CROSS-NATION CALLBACK // CONFIRMED</span>
                    <p>{causalityContext.causalityCallout}</p>
                  </aside>
                )}
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
                        <ol className="decision-options">
                          {reportState.report.options.map((option, index) => (
                            <li key={option}>
                              <button
                                type="button"
                                className={
                                  transmittingOption === option
                                    ? 'decision-option--transmitting'
                                    : undefined
                                }
                                disabled={transmittingOption !== null}
                                onClick={() => void executeDecision(option)}
                              >
                                <span>
                                  VECTOR {String(index + 1).padStart(2, '0')}
                                </span>
                                {transmittingOption === option
                                  ? 'TRANSMITTING…'
                                  : option}
                              </button>
                            </li>
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
        <span className="dock-label">
          ACTIVE CRISES // {String(crises.length).padStart(2, '0')}
        </span>
        <div className="crisis-dock-list">
          {crises.map((crisis) => (
            <button
              type="button"
              key={crisis.id}
              onClick={() => selectCrisis(crisis)}
            >
              <i className={`dock-threat dock-threat--${crisis.type}`} />
              <span>
                <strong>{crisis.location}</strong>
                {crisis.type.toUpperCase()} // PRIORITY
              </span>
            </button>
          ))}
        </div>
      </m.nav>

      <m.aside
        className="event-log hud-frame"
        aria-label="Executed decision log"
        aria-live="polite"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="event-log-header">
          <span>EXECUTED ORDERS</span>
          <span>{String(state.history.length).padStart(2, '0')}</span>
        </div>
        {state.history.length === 0 ? (
          <p className="event-log-empty">NO ORDERS COMMITTED // AWAITING INPUT</p>
        ) : (
          <ol>
            {state.history
              .slice(-5)
              .reverse()
              .map((decision) => (
                <li key={decision.id}>
                  <div>
                    <span>
                      {decision.nationId === 'united-states' ? 'US' : 'VEN'} //
                      TURN {String(decision.turn).padStart(2, '0')}
                    </span>
                    <time dateTime={decision.timestamp}>
                      {decision.timestamp.slice(11, 19)}Z
                    </time>
                  </div>
                  <strong>{decision.chosenOption}</strong>
                  <p>{decision.narrative}</p>
                </li>
              ))}
          </ol>
        )}
      </m.aside>

      {fallbackMode && (
        <div className="fallback-mode-badge" role="status">
          FALLBACK MODE // SEED DATA
        </div>
      )}

      <button
        type="button"
        className="perspective-test"
        disabled={perspectiveWipe || transmittingOption !== null}
        onClick={switchPerspective}
      >
        SWITCH PERSPECTIVE // {nextNation.shortName}
      </button>

      <div className="map-attribution">
        © <a href="https://www.openstreetmap.org/copyright">OSM</a> ©{' '}
        <a href="https://carto.com/attributions">CARTO</a>
      </div>

      <div className="film-grain" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <AnimatePresence>
        {perspectiveWipe && targetNation && (
          <PerspectiveTransition
            targetLetterhead={`${targetNation.seat.toUpperCase()} // ${targetNation.name.toUpperCase()}`}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

export default App
