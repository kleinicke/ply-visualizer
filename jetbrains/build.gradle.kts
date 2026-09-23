import org.jetbrains.intellij.platform.gradle.tasks.VerifyPluginTask

plugins {
    java
    id("org.jetbrains.intellij.platform") version "2.7.2"
}
group = "de.kleinicke"
version = "0.1.6"
repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}
val installedIde = providers.gradleProperty("localIde").orElse("/Applications/PyCharm.app")

dependencies {
    intellijPlatform {
        local(installedIde.get())
        bundledPlugin("com.intellij.modules.jcef")
        pluginVerifier()
        zipSigner()
    }
    testImplementation("junit:junit:4.13.2")
}
java { toolchain { languageVersion.set(JavaLanguageVersion.of(21)) } }
// Read the current SDK's Java 25 classes with its bundled compiler, while
// retaining Java 21 bytecode for the plugin's existing compatibility declaration.
val ideJavaHome = file(installedIde.get()).resolve("Contents/jbr/Contents/Home")
tasks.withType<JavaCompile>().configureEach {
    options.isFork = true
    options.forkOptions.executable = ideJavaHome.resolve("bin/javac").absolutePath
    options.release.set(21)
}
tasks.withType<Test>().configureEach {
    executable = ideJavaHome.resolve("bin/java").absolutePath
}

val marketplaceDescription = layout.buildDirectory.file("marketplace-description.html")
val prepareDescription by tasks.registering(Exec::class) {
    workingDir(rootDir)
    commandLine("node", "scripts/prepare-description.mjs")
    inputs.files("../README.md", "scripts/prepare-description.mjs", "../package-lock.json")
    outputs.file(marketplaceDescription)
}
intellijPlatform {
    buildSearchableOptions = false
    pluginConfiguration {
        name = "3D Visualizer"
        description = providers.fileContents(marketplaceDescription).asText
        ideaVersion {
            sinceBuild = "243"
            // Do not impose an artificial ceiling on future IDE releases.
            untilBuild = provider { null }
        }
    }

    signing {
        certificateChain = providers.environmentVariable("JETBRAINS_CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("JETBRAINS_PRIVATE_KEY")
        password = providers.environmentVariable("JETBRAINS_PRIVATE_KEY_PASSWORD")
        val localSigning = rootDir.resolve("../.local/jetbrains-signing")
        if (localSigning.resolve("chain.crt").isFile && localSigning.resolve("private.pem").isFile) {
            certificateChainFile = localSigning.resolve("chain.crt")
            privateKeyFile = localSigning.resolve("private.pem")
        }
    }
    publishing { token = providers.environmentVariable("JETBRAINS_PUBLISH_TOKEN") }
}
tasks.named("patchPluginXml") { dependsOn(prepareDescription) }
tasks.runIde {
    // Rebuilds must not dispose editors while native input checks are running.
    systemProperty("idea.auto.reload.plugins", "false")
    systemProperty("ide.browser.jcef.debug.port", "9224")
    val fixtures = providers.gradleProperty("viewerTestProject")
        .orElse(file("../../test_data").absolutePath)
    args(fixtures.get())
}
val prepareViewers by tasks.registering(Exec::class) {
    workingDir(rootDir)
    commandLine("node", "scripts/prepare-viewers.mjs")
}
tasks.processResources {
    dependsOn(prepareViewers)
    from(layout.buildDirectory.dir("viewer-resources"))
}

val checkFormats by tasks.registering(Exec::class) {
    workingDir(rootDir)
    commandLine("node", "scripts/register-formats.mjs", "--check")
}
tasks.compileJava { dependsOn(checkFormats) }
tasks.named("verifyPluginSignature") { dependsOn("signPlugin") }

// Verify against the installed IDE; do not download a separate test installation.
tasks.named<VerifyPluginTask>("verifyPlugin") {
    val ide = file(providers.gradleProperty("verificationIde").orElse(installedIde).get())
    ides.setFrom(if (ide.extension == "app") ide.resolve("Contents") else ide)
}
