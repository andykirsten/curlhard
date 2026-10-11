import { Link } from '@tanstack/react-router'

export function PrivacyPage() {
  return (
    <main className="safe-top mx-auto max-w-xl space-y-4 px-5 py-8 text-sm leading-relaxed">
      <Link to="/" className="text-primary underline">
        ← Zurück
      </Link>
      <h1 className="text-2xl font-bold">Datenschutzerklärung</h1>
      <p>
        Curlhard ist ein selbst gehosteter Workout-Tracker. Die Anwendung läuft auf einem Server in
        Deutschland (Hetzner). Es werden keine externen Tracker, Analyse-Dienste oder CDNs
        eingebunden.
      </p>
      <h2 className="text-lg font-semibold">Welche Daten werden gespeichert?</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Konto: E-Mail-Adresse, Anzeigename, Passwort (nur als Argon2id-Hash)</li>
        <li>Optional: Körpergewicht (für Körpergewichtsübungen)</li>
        <li>Trainingsdaten: Pläne, Sessions, Sätze, Notizen</li>
        <li>Technisch notwendig: ein Session-Cookie zur Anmeldung (HttpOnly, 30 Tage)</li>
      </ul>
      <h2 className="text-lg font-semibold">Deine Rechte</h2>
      <p>
        Unter Einstellungen kannst du alle deine Daten als JSON exportieren und dein Konto samt
        allen Daten unwiderruflich löschen. Backups werden verschlüsselt aufbewahrt und nach 14
        Tagen lokal überschrieben.
      </p>
      <h2 className="text-lg font-semibold">Kontakt</h2>
      <p>Verantwortlich ist der Betreiber dieser Instanz. Kontakt über den Administrator.</p>
    </main>
  )
}
