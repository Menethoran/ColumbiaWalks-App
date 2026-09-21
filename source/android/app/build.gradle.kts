plugins {
    id("com.android.application")
}

val releaseStorePath = providers.environmentVariable("CW_ANDROID_KEYSTORE").orNull
val releaseStorePassword = providers.environmentVariable(
    "CW_ANDROID_KEYSTORE_PASSWORD"
).orNull
val releaseKeyAlias = providers.environmentVariable("CW_ANDROID_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("CW_ANDROID_KEY_PASSWORD").orNull
val releaseSigningReady = listOf(
    releaseStorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { !it.isNullOrBlank() }
val releaseTaskRequested = gradle.startParameter.taskNames.any {
    it.contains("release", ignoreCase = true)
}

if (releaseTaskRequested && !releaseSigningReady) {
    throw GradleException(
        "Release signing is not configured. Set CW_ANDROID_KEYSTORE, " +
            "CW_ANDROID_KEYSTORE_PASSWORD, CW_ANDROID_KEY_ALIAS, and " +
            "CW_ANDROID_KEY_PASSWORD."
    )
}

android {
    namespace = "org.columbiawalks.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.columbiawalks.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 31600
        versionName = "3.16.0"
        buildConfigField(
            "String",
            "REPORT_ENDPOINT",
            "\"https://directus.rndtech.org/columbiawalks-api/reports\""
        )
        buildConfigField(
            "String",
            "FEEDBACK_ENDPOINT",
            "\"https://directus.rndtech.org/columbiawalks-api/feedback\""
        )
        buildConfigField(
            "String",
            "TRASH_CAN_ENDPOINT",
            "\"https://directus.rndtech.org/columbiawalks-api/trash-can-submissions\""
        )
        buildConfigField(
            "String",
            "UPDATE_RELEASE_API",
            "\"https://api.github.com/repos/Menethoran/ColumbiaWalks-App/releases/latest\""
        )
        buildConfigField(
            "String",
            "UPDATE_EVENT_ENDPOINT",
            "\"https://directus.rndtech.org/columbiawalks-api/app-update-events\""
        )
        buildConfigField(
            "String",
            "WALKING_METRIC_ENDPOINT",
            "\"https://directus.rndtech.org/columbiawalks-api/walking-metrics\""
        )
        buildConfigField("boolean", "SELF_UPDATE_ENABLED", "true")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = file(releaseStorePath!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        create("playRelease") {
            initWith(getByName("release"))
            matchingFallbacks += listOf("release")
            // Play Console can decode Java/Kotlin and native crash reports from
            // the artifacts emitted by this variant.
            isMinifyEnabled = true
            ndk {
                debugSymbolLevel = "FULL"
            }
            buildConfigField("boolean", "SELF_UPDATE_ENABLED", "false")
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// MapLibre ships prebuilt native libraries, so AGP cannot recover its private
// line-level symbols. Package the matching ELF symbol tables as a Play Console
// sidecar; upload this ZIP with the corresponding AAB in App Bundle Explorer.
val packagePlayReleaseNativeDebugSymbols by tasks.registering(Zip::class) {
    dependsOn("mergePlayReleaseNativeLibs")
    from(
        layout.buildDirectory.dir(
            "intermediates/merged_native_libs/playRelease/" +
                "mergePlayReleaseNativeLibs/out/lib"
        )
    )
    archiveFileName.set("native-debug-symbols.zip")
    destinationDirectory.set(
        layout.buildDirectory.dir("outputs/native-debug-symbols/playRelease")
    )
}

tasks.configureEach {
    if (name == "bundlePlayRelease") {
        finalizedBy(packagePlayReleaseNativeDebugSymbols)
    }
}

dependencies {
    testImplementation("org.json:json:20250517")
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.fragment:fragment:1.8.8")
    implementation("androidx.exifinterface:exifinterface:1.4.2")
    implementation("com.google.android.material:material:1.14.0")
    implementation("org.maplibre.gl:android-sdk:13.0.2")
    implementation("androidx.work:work-runtime:2.11.2")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
