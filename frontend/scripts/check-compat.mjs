// Prüft das gebaute CSS auf Features, die iOS 15 / Safari 15 nicht kennt.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist/assets'
if (!existsSync(dir)) {
  console.error('dist/assets fehlt – zuerst `npm run build` ausführen')
  process.exit(1)
}
const forbidden = [/color-mix\(/, /@property\s/, /:has\(/, /@container/, /\bdvh\b/]
let failed = false
for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
  const css = readFileSync(join(dir, file), 'utf8')
  for (const re of forbidden) {
    if (re.test(css)) {
      console.error(`${file}: enthält ${re}`)
      failed = true
    }
  }
}
if (failed) process.exit(1)
console.log('iOS-15-Kompatibilitätsprüfung (CSS) bestanden')
