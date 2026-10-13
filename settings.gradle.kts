pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "NeonWalls"
// Gemeinsamer Code (Broken Screen, Uhr, Bausteine der Einstellungen)
include(":core")
include(":app")
// Elektro-Plasma: eigene App (eigenes Paket, eigenes Symbol)
include(":plasma")
// Broken Screen: eigene App (gleicher Code wie in Neon Walls)
include(":brokenscreen")
