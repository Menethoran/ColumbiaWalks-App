plugins {
    id("com.android.application")
}

val appVersionName = "3.17.0"
val internalTestBuild = appVersionName.substringAfterLast(".") == "0"
val internalPlayRequested = gradle.startParameter.taskNames.any {
    it.contains("internalTesting", ignoreCase = true)
}
val distributionChannel = providers.gradleProperty("cwDistributionChannel").orNull
if (internalTestBuild && gradle.startParameter.taskNames.any {
        it.contains("release", ignoreCase = true) || it.contains("publish", ignoreCase = true)
    }) {
    throw GradleException("Versions ending in .0 are INTERNAL TEST ONLY. Use assembleDebug or the signed Internal testing build script.")
}

gradle.taskGraph.whenReady {
    if (internalTestBuild && allTasks.any {
            it.name.contains("release", ignoreCase = true) || it.name.contains("publish", ignoreCase = true)
        }) {
        throw GradleException("Internal .0 versions cannot build or publish public release variants.")
    }
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
val signedTaskRequested = internalPlayRequested || gradle.startParameter.taskNames.any {
    it.contains("release", ignoreCase = true)
}

if (internalPlayRequested && distributionChannel != "internal") {
    throw GradleException("The Internal testing bundle requires -PcwDistributionChannel=internal and must only be uploaded to Play Internal testing.")
}

if (signedTaskRequested && !releaseSigningReady) {
    throw GradleException(
        "Release signing is not configured. Set CW_ANDROID_KEYSTORE, " +
            "CW_ANDROID_KEYSTORE_PASSWORD, CW_ANDROID_KEY_ALIAS, and " +
            "CW_ANDROID_KEY_PASSWORD."
    )
}

gradle.taskGraph.whenReady {
    if (allTasks.any { it.name.contains("internalTesting", ignoreCase = true) } &&
        (distributionChannel != "internal" || !releaseSigningReady)) {
        throw GradleException("Internal testing tasks require the internal channel and the existing upload-signing key.")
    }
}

android {
    namespace = "org.columbiawalks.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.columbiawalks.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 31700
        versionName = appVersionName
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
        buildConfigField("boolean", "SELF_UPDATE_ENABLED", (!internalTestBuild).toString())
        buildConfigField("boolean", "INTERNAL_TEST_BUILD", internalTestBuild.toString())
        buildConfigField("String", "ANONYMOUS_TIP_ENDPOINT", "\"https://directus.rndtech.org/columbiawalks-api/anonymous-tip-tests\"")

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
        debug {
            if (internalTestBuild) applicationIdSuffix = ".internal"
            // A separate QA package can exercise an isolated local intake. The
            // distributable internal APK always keeps the fixed HTTPS endpoint.
            val testEndpoint = providers.gradleProperty("cwTipTestEndpoint").orNull
            if (testEndpoint != null) {
                if (!testEndpoint.matches(Regex("http://10\\.0\\.2\\.2:[0-9]{4,5}/columbiawalks-api/anonymous-tip-tests"))) {
                    throw GradleException("QA tip endpoint must be the local Android emulator host.")
                }
                applicationIdSuffix = if (internalTestBuild) ".internal.qa" else ".qa"
                buildConfigField("String", "ANONYMOUS_TIP_ENDPOINT", "\"$testEndpoint\"")
            }
        }
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
        create("internalTesting") {
            initWith(getByName("playRelease"))
            matchingFallbacks += listOf("release")
            // Keeps the existing Play package and upload certificate. The .0
            // public tasks stay blocked; only the Internal testing track is allowed.
            isDebuggable = false
            buildConfigField("boolean", "SELF_UPDATE_ENABLED", "false")
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

val packageInternalTestingNativeDebugSymbols by tasks.registering(Zip::class) {
    dependsOn("mergeInternalTestingNativeLibs")
    from(layout.buildDirectory.dir("intermediates/merged_native_libs/internalTesting/mergeInternalTestingNativeLibs/out/lib"))
    archiveFileName.set("native-debug-symbols.zip")
    destinationDirectory.set(layout.buildDirectory.dir("outputs/native-debug-symbols/internalTesting"))
}

tasks.configureEach {
    if (name == "bundleInternalTesting") {
        finalizedBy(packageInternalTestingNativeDebugSymbols)
    }
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
