import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Base64

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Jeder Build auf GitHub bekommt automatisch eine höhere Versionsnummer
val buildNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

// Gleicher Test-Schlüssel wie bei Neon Walls (liegt als Text im Ordner app)
val testKeystore = file("debug.keystore")
val testKeystoreB64 = rootProject.file("app/debug.keystore.b64")
if (!testKeystore.exists() && testKeystoreB64.exists()) {
    testKeystore.writeBytes(Base64.getMimeDecoder().decode(testKeystoreB64.readText().trim()))
}

android {
    namespace = "io.github.trustnobody947.brokenscreen"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.trustnobody947.brokenscreen"
        minSdk = 26
        targetSdk = 36
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // Nur zum Testen: fester Schlüssel, damit sich neue Versionen über alte installieren lassen
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
            // Code verkleinern und unlesbar machen (schwerer nachzubauen, kleinere APK)
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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

dependencies {
    implementation(project(":core"))
    // Werbung (App-Start-Anzeige, Werbevideo), Datenschutz-Abfrage (EU) und Kauf über Google Play
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    implementation("com.android.billingclient:billing:9.1.0")
}
