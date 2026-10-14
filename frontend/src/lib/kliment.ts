// Kliment-Modus: zufällige Zurufe während des Workouts, per Sprachausgabe (Web Speech API).
export const PHRASES = ['Komm schon!', 'Los jetzt!', 'Noch drei!', 'Bwroup!'] as const
export type Phrase = (typeof PHRASES)[number]

const MIN_DELAY_MS = 45_000
const MAX_DELAY_MS = 180_000

export function pickPhrase(rng: () => number = Math.random): Phrase {
  const i = Math.min(PHRASES.length - 1, Math.floor(rng() * PHRASES.length))
  return PHRASES[i] ?? PHRASES[0]
}

/** Wartezeit bis zum nächsten Auftritt: zufällig zwischen 45 und 180 Sekunden. */
export function nextDelayMs(rng: () => number = Math.random): number {
  return Math.round(MIN_DELAY_MS + rng() * (MAX_DELAY_MS - MIN_DELAY_MS))
}

const MALE_HINTS =
  /\b(markus|stefan|hans|martin|conrad|florian|jonas|killian|yannick|male|männlich)\b/i
const FEMALE_HINTS = /\b(anna|petra|marlene|vicki|katja|amala|female|weiblich)\b/i

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis ?? null
}

function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const german = s
    .getVoices()
    .filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('de'))
  return (
    german.find((v) => MALE_HINTS.test(v.name) && !FEMALE_HINTS.test(v.name)) ??
    german.find((v) => !FEMALE_HINTS.test(v.name)) ??
    german[0]
  )
}

/** Spricht die Phrase tief und monoton; ohne Sprachausgabe passiert nichts. */
export function speak(phrase: string): void {
  const s = synth()
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    s.cancel()
    const u = new SpeechSynthesisUtterance(phrase)
    u.lang = 'de-DE'
    u.pitch = 0.1
    u.rate = 0.85
    const voice = pickVoice(s)
    if (voice) u.voice = voice
    s.speak(u)
  } catch {
    /* Sprachausgabe nicht verfügbar */
  }
}

/** iOS erlaubt Sprachausgabe erst nach einer Nutzergeste: einmal lautlos sprechen. */
export function unlockSpeech(): void {
  const s = synth()
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    s.speak(u)
  } catch {
    /* ignorieren */
  }
}
