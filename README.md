# Neon Walls

Live-Hintergründe für Android:

- **Broken Screen** – flackernde Farbstreifen wie bei einem kaputten Display, mit Haarriss, Abzweig und zufälligen Glitch-Ausbrüchen.
- **Pegelanzeige** – LED-Balken wie an einer alten Stereoanlage. Reagieren auf Musik vom Handy (Visualizer) oder auf das Mikrofon; beides braucht die Mikrofon-Berechtigung. Ohne Berechtigung läuft ein Demo-Beat.
- **Uhr** – Schablonen-Uhr mit echter Uhrzeit und Datum, bei jedem Hintergrund einzeln einschaltbar (Chrom, Gold, Stahlblau, Roségold, Schwarzchrom, Kupfer, Neon). Bei Broken Screen läuft ein Haarriss durch die Ziffern, der große Riss versetzt sie und Glitches zerlegen sie kurz.

In der App wählt man oben zwischen den Hintergründen; die Uhr stellt man unten in den Einstellungen des jeweiligen Hintergrunds ein.

## APK herunterladen

Jeder Push auf `main` baut die App automatisch. Die fertige APK liegt danach unter **Releases**.

Direkter Link zur neuesten Version:
`https://github.com/TrustNobody947/NeonWalls/releases/latest/download/NeonWalls.apk`

## Aufbau

- `app/src/main/java/.../glitch/` – Broken Screen (Renderer, Wallpaper-Service, Vorschau, Einstellungen)
- `app/src/main/java/.../pegel/` – Pegelanzeige (Renderer, Demo-Song, Audio aus Musik oder Mikrofon, Wallpaper-Service, Vorschau, Einstellungen)
- `app/src/main/java/.../uhr/` – Schablonen-Uhr (Zifferblatt als Bild, Einstellungen); gezeichnet wird sie von den Renderern der Hintergründe
- Weitere Hintergründe kommen jeweils in einen eigenen Unterordner und bekommen einen eigenen Wallpaper-Service.

## Vorschauen (im Browser)

Unter `vorschau/` liegen die Browser-Vorschauen der Hintergründe, jeweils als eigenständige HTML-Seite:

- `broken-screen.html` – Broken Screen (in der App enthalten)
- `tintenfleck.html` – LCD-Tintenfleck
- `geisterbild.html` – Eingebranntes Geisterbild
- `pixelfehler.html` – Pixelfehler und Pixelstürme
- `plasma.html` – Plasma-Blitze
- `roehre.html` – Röhrenmonitor (Oszilloskop, Terminal, Radar)
- `platine.html` – Neon-Platine
- `wackelkontakt.html` – Wackelkontakt (loses Displaykabel)
- `ghosttouch.html` – Ghost Touch (Zeigerposition wie in den Entwickleroptionen)
- `backlight.html` – Kaputtes Backlight
- `nixie.html` – Nixie-Uhr mit echter Uhrzeit
- `jakobsleiter.html` – Jakobsleiter (aufsteigender Lichtbogen)
- `leuchtreklame.html` – Leuchtreklame mit eigenem Text (Schriften von Google Fonts)
- `nebelkammer.html` – Nebelkammer mit Teilchenspuren
- `pegel.html` – LED-Pegelanzeige (in der Vorschau simulierter Beat; in der App mit Musik oder Mikrofon)
- `uhr.html` – Schablonen-Uhr, wahlweise über Broken Screen
- `plasmaschirm.html` – Plasma-Bildschirm (Lichtbögen über den ganzen Bildschirm, folgen dem Finger)

Alle Seiten außer `broken-screen.html` werden aus `vorschau/quellen/` gebaut (`python3 build.py`, Test ohne Browser: `node test.js <name>`). Gemeinsame Bausteine liegen in `vorschau/quellen/lib/` und werden mit einer Zeile `//#include name.js` eingebunden (z. B. der Kamera-Look). Änderungen unter `vorschau/` lösen keinen App-Build aus.

## Hinweis zur Signierung

Die Test-APKs werden mit einem festen Testschlüssel signiert, damit Updates direkt über die alte Version installiert werden können. Der Schlüssel liegt als Text in `app/debug.keystore.b64` und wird beim Bauen automatisch zu `app/debug.keystore`. Für den Play Store wird später ein eigener, geheimer Upload-Schlüssel verwendet.

## Nur Textdateien

Das Repo enthält keine Binärdateien: Gradle wird im Build über `gradle/actions/setup-gradle` in Version 8.14.3 bereitgestellt (lokal: `gradle assembleRelease`).
