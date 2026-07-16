import L from 'leaflet'
import type { CrisisType } from '../types'

const frames: Record<CrisisType, string> = {
  military: '<path class="marker-frame marker-frame--military" d="M18 2 31 9v18l-13 7L5 27V9Z"/><path class="marker-glyph" d="m12 23 6-11 6 11-6-3Z"/>',
  humanitarian: '<path class="marker-frame marker-frame--humanitarian" d="M11 3h14l8 8v14l-8 8H11l-8-8V11Z"/><path class="marker-glyph" d="M18 11v14M11 18h14"/>',
  economic: '<path class="marker-frame marker-frame--economic" d="M4 13V5h8M32 13V5h-8M4 23v8h8M32 23v8h-8"/><path class="marker-glyph" d="M13 22c1 3 9 3 10-1 1-6-10-1-9-7 1-4 8-4 10-1M19 9v18"/>',
  diplomatic: '<rect class="marker-frame marker-frame--diplomatic" x="5" y="5" width="26" height="26" rx="8"/><path class="marker-glyph" d="M11 20c5-8 9 5 14-3M11 25c5-8 9 5 14-3"/>',
}

export function createCrisisIcon(type: CrisisType) {
  return L.divIcon({
    className: `crisis-marker-wrap crisis-marker-wrap--${type}`,
    html: `
      <span class="crisis-marker" aria-hidden="true">
        <span class="threat-ring threat-ring--one"></span>
        <span class="threat-ring threat-ring--two"></span>
        <svg viewBox="0 0 36 36" role="presentation">
          <circle class="reticle-ring" cx="18" cy="18" r="8"/>
          <path class="reticle-ticks" d="M18 1v7M18 28v7M1 18h7M28 18h7"/>
          ${frames[type]}
          <circle class="marker-core" cx="18" cy="18" r="2.5"/>
        </svg>
      </span>
    `,
    iconAnchor: [26, 26],
    iconSize: [52, 52],
  })
}

