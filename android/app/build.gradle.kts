plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("com.facebook.react")
}

// Keep app build outputs outside OneDrive to avoid AccessDeniedException during resource generation.
layout.buildDirectory.set(
  file("${System.getProperty("user.home")}/.speech-to-live/gradle-build/app"),
)

val jscFlavor = "io.github.react-native-community:jsc-android:2026004.+"
val hermesEnabled = (project.findProperty("hermesEnabled") as String).toBoolean()

react {
  autolinkLibrariesWithApp()
}

android {
  ndkVersion = rootProject.extra["ndkVersion"] as String
  buildToolsVersion = rootProject.extra["buildToolsVersion"] as String
  compileSdk = rootProject.extra["compileSdkVersion"] as Int

  namespace = "com.speechtolive.app"

  defaultConfig {
    applicationId = "com.speechtolive.app"
    minSdk = rootProject.extra["minSdkVersion"] as Int
    targetSdk = rootProject.extra["targetSdkVersion"] as Int
    versionCode = 1
    versionName = "1.0"
  }

  signingConfigs {
    getByName("debug") {
      storeFile = file("debug.keystore")
      storePassword = "android"
      keyAlias = "androiddebugkey"
      keyPassword = "android"
    }
  }

  buildTypes {
    getByName("debug") {
      signingConfig = signingConfigs.getByName("debug")
    }
    getByName("release") {
      signingConfig = signingConfigs.getByName("debug")
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }
}

dependencies {
  implementation("com.facebook.react:react-android")
  implementation("androidx.core:core-ktx:1.16.0")
  implementation(files("libs/sherpa-onnx-1.13.5.aar"))

  if (hermesEnabled) {
    implementation("com.facebook.react:hermes-android")
  } else {
    implementation(jscFlavor)
  }
}
