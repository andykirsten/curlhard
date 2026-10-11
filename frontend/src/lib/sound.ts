// Web Audio: AudioContext muss in iOS per Nutzergeste freigeschaltet werden.
type AudioCtor = typeof AudioContext
let ctx: AudioContext | null = null

function ctor(): AudioCtor | undefined {
  const w = window as unknown as {
    AudioContext?: AudioCtor
    webkitAudioContext?: AudioCtor
  }
  return w.AudioContext ?? w.webkitAudioContext
}

export function unlockAudio(): void {
  const Ctor = ctor()
  if (!Ctor) return
  try {
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* Audio nicht verfügbar */
  }
}

export function beep(times = 3): void {
  if (!ctx) return
  try {
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const start = ctx.currentTime + i * 0.3
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.22)
    }
  } catch {
    /* ignorieren */
  }
}
