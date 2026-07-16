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
import type { NationDefinition, NationId } from '../types'

export type NationWorldState = {
  turn: number
  meters: Record<string, number>
}

export type GameState = {
  activeNation: NationId
  nations: Record<NationId, NationWorldState>
}

export type GameAction =
  | { type: 'SET_ACTIVE_NATION'; nationId: NationId }
  | {
      type: 'APPLY_DELTAS'
      deltas: Record<string, number>
      nationId?: NationId
    }
  | { type: 'ADVANCE_TURN'; nationId?: NationId }
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
    }
  } catch {
    return INITIAL_GAME_STATE
  }
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

