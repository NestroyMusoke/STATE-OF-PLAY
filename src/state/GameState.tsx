import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { getInitialMeters, NATIONS } from '../game/nations'
import type { DecisionRecord, NationDefinition, NationId } from '../types'

export type NationWorldState = {
  turn: number
  meters: Record<string, number>
}

export type GameState = {
  activeNation: NationId
  nations: Record<NationId, NationWorldState>
  history: DecisionRecord[]
  appliedCrossNationDecisionIds: string[]
}

export type GameAction =
  | { type: 'SET_ACTIVE_NATION'; nationId: NationId }
  | {
      type: 'APPLY_DELTAS'
      deltas: Record<string, number>
      nationId?: NationId
    }
  | { type: 'ADVANCE_TURN'; nationId?: NationId }
  | { type: 'RECORD_DECISION'; decision: DecisionRecord }
  | {
      type: 'APPLY_CROSS_NATION_CALLBACK'
      decisionId: string
      deltas: Record<string, number>
    }
  | { type: 'RESET' }

const STORAGE_KEY = 'state-of-play.game-state.v2'

export const INITIAL_GAME_STATE: GameState = {
  activeNation: 'united-states',
  nations: {
    'united-states': {
      turn: 1,
      meters: getInitialMeters('united-states'),
    },
    venezuela: {
      turn: 1,
      meters: getInitialMeters('venezuela'),
    },
  },
  history: [],
  appliedCrossNationDecisionIds: [],
}

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function sanitizeNationState(
  nationId: NationId,
  candidate: Partial<NationWorldState> | undefined,
): NationWorldState {
  const initialMeters = getInitialMeters(nationId)
  const candidateMeters = candidate?.meters ?? {}

  return {
    turn:
      typeof candidate?.turn === 'number' && candidate.turn >= 1
        ? Math.floor(candidate.turn)
        : 1,
    meters: Object.fromEntries(
      Object.entries(initialMeters).map(([key, initial]) => [
        key,
        typeof candidateMeters[key] === 'number'
          ? clampMeter(candidateMeters[key])
          : initial,
      ]),
    ),
  }
}

function loadGameState(): GameState {
  if (typeof window === 'undefined') return INITIAL_GAME_STATE

  try {
    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      return INITIAL_GAME_STATE
    }
    const rawState = window.localStorage.getItem(STORAGE_KEY)
    if (!rawState) return INITIAL_GAME_STATE

    const saved = JSON.parse(rawState) as Partial<GameState>
    const activeNation: NationId =
      saved.activeNation === 'venezuela' ? 'venezuela' : 'united-states'

    return {
      activeNation,
      nations: {
        'united-states': sanitizeNationState(
          'united-states',
          saved.nations?.['united-states'],
        ),
        venezuela: sanitizeNationState(
          'venezuela',
          saved.nations?.venezuela,
        ),
      },
      history: Array.isArray(saved.history)
        ? saved.history.filter(isDecisionRecord).slice(-50)
        : [],
      appliedCrossNationDecisionIds: Array.isArray(
        saved.appliedCrossNationDecisionIds,
      )
        ? saved.appliedCrossNationDecisionIds
            .filter((id): id is string => typeof id === 'string')
            .slice(-50)
        : [],
    }
  } catch {
    return INITIAL_GAME_STATE
  }
}

function isDecisionRecord(value: unknown): value is DecisionRecord {
  if (typeof value !== 'object' || value === null) return false
  const decision = value as Partial<DecisionRecord>
  return (
    typeof decision.id === 'string' &&
    (decision.nationId === 'united-states' ||
      decision.nationId === 'venezuela') &&
    typeof decision.crisisId === 'string' &&
    typeof decision.crisisTitle === 'string' &&
    typeof decision.chosenOption === 'string' &&
    typeof decision.narrative === 'string' &&
    typeof decision.turn === 'number' &&
    typeof decision.timestamp === 'string' &&
    typeof decision.deltas === 'object' &&
    decision.deltas !== null
  )
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_ACTIVE_NATION':
      return { ...state, activeNation: action.nationId }

    case 'APPLY_DELTAS': {
      const nationId = action.nationId ?? state.activeNation
      const current = state.nations[nationId]
      const meters = Object.fromEntries(
        Object.entries(current.meters).map(([key, value]) => [
          key,
          clampMeter(value + (action.deltas[key] ?? 0)),
        ]),
      )

      return {
        ...state,
        nations: {
          ...state.nations,
          [nationId]: { ...current, meters },
        },
      }
    }

    case 'ADVANCE_TURN': {
      const nationId = action.nationId ?? state.activeNation
      const current = state.nations[nationId]

      return {
        ...state,
        nations: {
          ...state.nations,
          [nationId]: { ...current, turn: current.turn + 1 },
        },
      }
    }

    case 'RECORD_DECISION':
      return {
        ...state,
        history: [...state.history, action.decision].slice(-50),
      }

    case 'APPLY_CROSS_NATION_CALLBACK': {
      if (state.appliedCrossNationDecisionIds.includes(action.decisionId)) {
        return state
      }

      const current = state.nations.venezuela
      const meters = Object.fromEntries(
        Object.entries(current.meters).map(([key, value]) => [
          key,
          clampMeter(value + (action.deltas[key] ?? 0)),
        ]),
      )

      return {
        ...state,
        nations: {
          ...state.nations,
          venezuela: { ...current, meters },
        },
        appliedCrossNationDecisionIds: [
          ...state.appliedCrossNationDecisionIds,
          action.decisionId,
        ].slice(-50),
      }
    }

    case 'RESET':
      return INITIAL_GAME_STATE

    default:
      return state
  }
}

type GameStateContextValue = {
  state: GameState
  activeNation: NationDefinition
  activeWorldState: NationWorldState
  dispatch: Dispatch<GameAction>
}

const GameStateContext = createContext<GameStateContextValue | null>(null)

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    INITIAL_GAME_STATE,
    loadGameState,
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(
    () => ({
      state,
      activeNation: NATIONS[state.activeNation],
      activeWorldState: state.nations[state.activeNation],
      dispatch,
    }),
    [state],
  )

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  )
}

export function useGameState() {
  const context = useContext(GameStateContext)

  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider')
  }

  return context
}
