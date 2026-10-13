import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Gemeinsamer Code für Neon Walls und die einzelnen Apps: Broken Screen, Schablonen-Uhr, Bausteine der Einstellungen
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.trustnobody947.neonwalls.core"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
