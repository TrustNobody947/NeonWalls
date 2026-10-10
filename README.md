# Neon Walls

Live-Hintergründe für Android. Erster Hintergrund: **Broken Screen** – flackernde Farbstreifen wie bei einem kaputten Display, mit Haarriss, Abzweig und zufälligen Glitch-Ausbrüchen.

## APK herunterladen

Jeder Push auf `main` baut die App automatisch. Die fertige APK liegt danach unter **Releases**.

Direkter Link zur neuesten Version:
`https://github.com/TrustNobody947/NeonWalls/releases/latest/download/NeonWalls.apk`

## Aufbau

- `app/src/main/java/.../glitch/` – der Broken-Screen-Hintergrund (Renderer, Wallpaper-Service, Vorschau, Einstellungen)
- Weitere Hintergründe (z. B. Plasma) kommen jeweils in einen eigenen Unterordner und bekommen einen eigenen Wallpaper-Service.

## Hinweis zur Signierung

Die Test-APKs werden mit einem festen Testschlüssel signiert, damit Updates direkt über die alte Version installiert werden können. Der Schlüssel liegt als Text in `app/debug.keystore.b64` und wird beim Bauen automatisch zu `app/debug.keystore`. Für den Play Store wird später ein eigener, geheimer Upload-Schlüssel verwendet.

## Nur Textdateien

Das Repo enthält keine Binärdateien: Gradle wird im Build über `gradle/actions/setup-gradle` in Version 8.14.3 bereitgestellt (lokal: `gradle assembleRelease`).
