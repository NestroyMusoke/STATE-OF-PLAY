import { Howl, Howler } from 'howler'
import type { CrisisType } from './types'

const staticBlip = new Howl({
  src: ['/audio/static-blip.wav'],
  volume: 0.12,
  preload: true,
})

const decisionImpact = new Howl({
  src: ['/audio/static-blip.wav'],
  volume: 0.22,
  rate: 0.58,
  preload: true,
})

const ambientComms = new Howl({
  src: ['/audio/ambient-comms.wav'],
  volume: 0.16,
  loop: true,
  preload: false,
})

const stingers: Record<CrisisType, Howl> = {
  military: new Howl({ src: ['/audio/stinger-military.wav'], volume: 0.3 }),
  humanitarian: new Howl({ src: ['/audio/stinger-humanitarian.wav'], volume: 0.28 }),
  economic: new Howl({ src: ['/audio/stinger-economic.wav'], volume: 0.26 }),
  diplomatic: new Howl({ src: ['/audio/stinger-diplomatic.wav'], volume: 0.24 }),
}

export function playStaticBlip() {
  staticBlip.play()
}

export function playCrisisStinger(type: CrisisType) {
  stingers[type].stop()
  stingers[type].play()
}

export function playDecisionImpact() {
  decisionImpact.stop()
  decisionImpact.play()
}

export function setAmbientEnabled(enabled: boolean) {
  if (enabled) {
    ambientComms.play()
    return
  }

  ambientComms.pause()
}

export function setGlobalAudioMuted(muted: boolean) {
  Howler.mute(muted)
}
