import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Jeder Build auf GitHub bekommt automatisch eine höhere Versionsnummer
val buildNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

// Der Test-Schlüssel liegt als Text (Base64) im Repo, damit das ganze Projekt nur aus Textdateien besteht.
// Beim Bauen wird daraus automatisch wieder die Schlüsseldatei.
val testKeystore = file("debug.keystore")
val testKeystoreB64 = file("debug.keystore.b64")
if (!testKeystore.exists() && testKeystoreB64.exists()) {
    testKeystore.writeBytes(java.util.Base64.getMimeDecoder().decode(testKeystoreB64.readText().trim()))
}

android {
    namespace = "io.github.trustnobody947.neonwalls"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.trustnobody947.neonwalls"
        minSdk = 26
        targetSdk = 36
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // Fester Schlüssel im Repo: Damit lässt sich jede neue APK direkt über die alte installieren.
    // Nur zum Testen gedacht. Für den Play Store kommt später ein eigener, geheimer Schlüssel.
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
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
