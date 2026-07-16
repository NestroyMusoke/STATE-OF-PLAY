import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const sampleRate = 22050

function wavBuffer(samples) {
  const bytesPerSample = 2
  const dataLength = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataLength)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  samples.forEach((sample, index) => {
    const clipped = Math.max(-1, Math.min(1, sample))
    buffer.writeInt16LE(Math.round(clipped * 32767), 44 + index * bytesPerSample)
  })

  return buffer
}

function envelope(t, duration, attack = 0.025, release = 0.12) {
  return Math.min(1, t / attack, (duration - t) / release)
}

function tone(duration, voices, noise = 0) {
  const length = Math.floor(duration * sampleRate)
  let seed = 918273
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  return Array.from({ length }, (_, index) => {
    const t = index / sampleRate
    const voiced = voices.reduce((sum, voice) => {
      const frequency = typeof voice.frequency === 'function' ? voice.frequency(t) : voice.frequency
      return sum + Math.sin(Math.PI * 2 * frequency * t + (voice.phase ?? 0)) * voice.gain
    }, 0)
    return (voiced + (random() * 2 - 1) * noise) * envelope(t, duration)
  })
}

function ambientComms() {
  const duration = 8
  const length = duration * sampleRate
  let seed = 41233
  const random = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }

  return Array.from({ length }, (_, index) => {
    const t = index / sampleRate
    const burstA = Math.max(0, Math.sin(t * 2.1) - 0.62)
    const burstB = Math.max(0, Math.sin(t * 3.7 + 1.4) - 0.78)
    const carrier =
      Math.sin(Math.PI * 2 * (178 + Math.sin(t * 7) * 28) * t) * burstA * 0.07 +
      Math.sin(Math.PI * 2 * (486 + Math.sin(t * 11) * 64) * t) * burstB * 0.035
    const radioNoise = (random() * 2 - 1) * (0.012 + burstA * 0.03)
    const click = index % 32771 < 18 ? Math.sin(index * 0.8) * 0.03 : 0
    const loopFade = Math.min(1, t / 0.12, (duration - t) / 0.12)
    return (carrier + radioNoise + click) * loopFade
  })
}

const assets = {
  'static-blip.wav': tone(0.055, [{ frequency: 920, gain: 0.12 }], 0.08),
  'stinger-military.wav': tone(0.58, [
    { frequency: (t) => 112 - t * 44, gain: 0.28 },
    { frequency: 224, gain: 0.08 },
  ], 0.025),
  'stinger-humanitarian.wav': tone(0.66, [
    { frequency: (t) => 330 + t * 150, gain: 0.15 },
    { frequency: 660, gain: 0.06, phase: 0.8 },
  ], 0.012),
  'stinger-economic.wav': tone(0.48, [
    { frequency: (t) => 520 + Math.floor(t * 12) * 55, gain: 0.12 },
    { frequency: 1040, gain: 0.04 },
  ], 0.008),
  'stinger-diplomatic.wav': tone(0.72, [
    { frequency: (t) => 240 + Math.sin(t * 9) * 35, gain: 0.12 },
    { frequency: 360, gain: 0.07, phase: 1.2 },
  ], 0.006),
  'ambient-comms.wav': ambientComms(),
}

for (const [filename, samples] of Object.entries(assets)) {
  const output = resolve('public', 'audio', filename)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, wavBuffer(samples))
  process.stdout.write(`generated ${output}\n`)
}

