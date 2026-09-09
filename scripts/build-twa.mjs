#!/usr/bin/env node
/**
 * Automated build script for Debate Master Trusted Web Activity (TWA) with Google Play Billing.
 *
 * Requirements:
 * - Bubblewrap CLI (`npm install -g @bubblewrap/cli`)
 * - JDK 17 & Android SDK configured via `bubblewrap doctor`
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const TWA_DIR = path.join(ROOT, "twa");
const MANIFEST_PATH = path.join(TWA_DIR, "twa-manifest.json");
const CHECKSUM_PATH = path.join(TWA_DIR, "manifest-checksum.txt");
const KEYSTORE_PATH = path.join(TWA_DIR, "signing.keystore");

// Load environment variables from .env.local or .env if present
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = (match[2] || "").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

const KEYSTORE_PASS = process.env.BUBBLEWRAP_KEYSTORE_PASSWORD || "";
const KEY_PASS = process.env.BUBBLEWRAP_KEY_PASSWORD || process.env.BUBBLEWRAP_KEYSTORE_PASSWORD || "";
const KEY_ALIAS = process.env.BUBBLEWRAP_KEY_ALIAS || "my-key-alias";

if (!KEYSTORE_PASS) {
  console.error("❌ Missing BUBBLEWRAP_KEYSTORE_PASSWORD. Please set it in .env.local or process environment.");
  process.exit(1);
}

console.log("🚀 Starting Debate Master TWA build with Google Play Billing...");

if (!fs.existsSync(TWA_DIR)) {
  fs.mkdirSync(TWA_DIR, { recursive: true });
}

// 1. Ensure Keystore exists
if (!fs.existsSync(KEYSTORE_PATH)) {
  console.log("🔑 Generating upload keystore at twa/signing.keystore...");
  execSync(
    `keytool -genkeypair -v -keystore "${KEYSTORE_PATH}" -alias "${KEY_ALIAS}" -keyalg RSA -keysize 2048 -validity 10000 -storepass "${KEYSTORE_PASS}" -keypass "${KEY_PASS}" -dname "CN=Debate Master Admin, OU=Engineering, O=Debate Master, C=US"`,
    { stdio: "inherit" }
  );
}

// 2. Ensure manifest checksum is up to date to bypass interactive prompt
if (fs.existsSync(MANIFEST_PATH)) {
  const manifestData = fs.readFileSync(MANIFEST_PATH);
  const hash = crypto.createHash("sha1").update(manifestData).digest("hex");
  fs.writeFileSync(CHECKSUM_PATH, hash);
}

const gradlePath = path.join(TWA_DIR, "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, "utf8");
  let modified = false;
  if (gradle.includes("billing:1.1.0")) {
    gradle = gradle.replace("billing:1.1.0", "billing:1.2.0");
    modified = true;
  }
  if (gradle.includes("minSdkVersion 21")) {
    gradle = gradle.replace("minSdkVersion 21", "minSdkVersion 23");
    modified = true;
  }
  if (gradle.includes("targetSdkVersion 35")) {
    gradle = gradle.replace("targetSdkVersion 35", "targetSdkVersion 36");
    modified = true;
  }
  if (modified) {
    fs.writeFileSync(gradlePath, gradle);
  }
}

// 3. Run Bubblewrap build
console.log("📦 Compiling AAB & APK with Bubblewrap...");
try {
  execSync(
    `cd "${TWA_DIR}" && BUBBLEWRAP_KEYSTORE_PASSWORD="${KEYSTORE_PASS}" BUBBLEWRAP_KEY_PASSWORD="${KEY_PASS}" bubblewrap build`,
    { stdio: "inherit" }
  );
} catch (err) {
  console.error("❌ Bubblewrap build failed:", err);
  process.exit(1);
}

// 4. Print SHA-256 fingerprint for Play Console / assetlinks
console.log("\n✅ TWA Build Complete!");
console.log("📱 Output files:");
console.log(`   - AAB (Upload to Google Play): ${path.join(TWA_DIR, "app-release-bundle.aab")}`);
console.log(`   - APK (Direct install/test):   ${path.join(TWA_DIR, "app-release-signed.apk")}`);

try {
  const fpOutput = execSync(
    `keytool -list -v -keystore "${KEYSTORE_PATH}" -alias "${KEY_ALIAS}" -storepass "${KEYSTORE_PASS}" | grep "SHA256:"`,
    { encoding: "utf8" }
  );
  console.log("\n🔐 Upload Certificate Fingerprint:");
  console.log(`   ${fpOutput.trim()}`);
  console.log("   👉 Remember to add this to ANDROID_CERT_FINGERPRINTS in Vercel!");
} catch {
  // Grep might fail or differ on Windows
}
