import type { Crisis, CrisisType, Headline } from '../types'

const VENEZUELA_LOCATIONS: Array<{
  location: string
  coordinates: [number, number]
}> = [
  { location: 'Caracas, Venezuela', coordinates: [10.48, -66.9] },
  { location: 'La Guaira, Venezuela', coordinates: [10.6, -66.93] },
  { location: 'Maracaibo, Venezuela', coordinates: [10.65, -71.64] },
  { location: 'Valencia, Venezuela', coordinates: [10.16, -68.01] },
  { location: 'Ciudad Guayana, Venezuela', coordinates: [8.35, -62.65] },
  { location: 'Barquisimeto, Venezuela', coordinates: [10.07, -69.32] },
  { location: 'Mérida, Venezuela', coordinates: [8.59, -71.14] },
  { location: 'Cumaná, Venezuela', coordinates: [10.46, -64.18] },
  { location: 'San Cristóbal, Venezuela', coordinates: [7.77, -72.23] },
  { location: 'Puerto La Cruz, Venezuela', coordinates: [10.22, -64.63] },
]

function stableIndex(value: string, length: number) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return hash % length
}

function inferCrisisType(title: string): CrisisType {
  if (/earthquake|quake|aid|relief|health|illness|diarrhea|humanitarian/i.test(title)) {
    return 'humanitarian'
  }
  if (/sanction|economist|oil|treasury|market|economic/i.test(title)) {
    return 'economic'
  }
  if (/military|armed|force|capture|security|attack/i.test(title)) {
    return 'military'
  }
  return 'diplomatic'
}

export function headlineToCrisis(
  headline: Headline,
  locationIndex = stableIndex(headline.id, VENEZUELA_LOCATIONS.length),
): Crisis {
  const location =
    VENEZUELA_LOCATIONS[locationIndex % VENEZUELA_LOCATIONS.length]
  const published = new Date(headline.publishedAt)
  const timestamp = Number.isNaN(published.getTime())
    ? 'TIME UNVERIFIED'
    : published.toISOString().slice(0, 16).replace('T', ' ') + 'Z'

  return {
    id: headline.id,
    title: headline.title,
    location: location.location,
    coordinates: location.coordinates,
    type: inferCrisisType(headline.title),
    intelFragment: `CLASSIFIED // ${headline.source.toUpperCase()} // ${timestamp}`,
  }
}

export function headlinesToCrises(headlines: Headline[]) {
  return headlines.map((headline, index) => headlineToCrisis(headline, index))
}
