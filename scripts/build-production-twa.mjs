#!/usr/bin/env node
// Build the generated Bubblewrap project without putting signing passwords in arguments.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const twa = join(root, 'twa');
const manifest = JSON.parse(readFileSync(join(twa, 'twa-manifest.json'), 'utf8'));
if (manifest.host !== 'debate-master-psi.vercel.app' || !manifest.features?.playBilling?.enabled) {
  throw new Error('Production host and Google Play Billing must be configured.');
}
if (!Number.isInteger(manifest.minSdkVersion) || manifest.minSdkVersion < 24) {
  throw new Error('Google Play automatic protection requires minimum SDK 24 or higher.');
}
if (!process.env.BUBBLEWRAP_KEYSTORE_PASSWORD || !process.env.BUBBLEWRAP_KEY_PASSWORD) {
  throw new Error('Provide upload signing passwords through environment variables.');
}
const key = resolve(twa, manifest.signingKey.path);
if (!existsSync(key)) throw new Error('The existing Play upload keystore is required.');
const config = JSON.parse(readFileSync(join(homedir(), '.bubblewrap/config.json'), 'utf8'));
const jdk = existsSync(join(config.jdkPath, 'Contents/Home/bin/java'))
  ? join(config.jdkPath, 'Contents/Home') : config.jdkPath;
const buildEnv = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: config.androidSdkPath,
  ANDROID_SDK_ROOT: config.androidSdkPath };
const gradleFile = join(twa, 'app/build.gradle');
let gradle = readFileSync(gradleFile, 'utf8');
// Play can retain localized overrides for old resource names. Routing must not
// depend on a translated string; use literal manifest values and fresh names.
const launchUrl = `https://${manifest.host}${manifest.startUrl}`;
const androidManifestFile = join(twa, 'app/src/main/AndroidManifest.xml');
let androidManifest = readFileSync(androidManifestFile, 'utf8')
  .replace(/android:value="@string\/(?:launchUrl|dmProductionLaunchUrl)"/g, `android:value="${launchUrl}"`)
  .replace(/android:host="@string\/(?:hostName|dmProductionHost)"/g, `android:host="${manifest.host}"`)
  .replace(/android:value="@string\/(?:webManifestUrl|dmProductionWebManifestUrl)"/g,
    `android:value="${manifest.webManifestUrl}"`)
  .replace(/@string\/assetStatements/g, '@string/dmProductionAssetStatements');
writeFileSync(androidManifestFile, androidManifest);
const stringsFile = join(twa, 'app/src/main/res/values/strings.xml');
const strings = readFileSync(stringsFile, 'utf8').replace(
  /<string name="(?:assetStatements|dmProductionAssetStatements)"[^>]*>/,
  '<string name="dmProductionAssetStatements" translatable="false">');
writeFileSync(stringsFile, strings);
for (const [oldName, newName] of Object.entries({
  hostName: 'dmProductionHost', launchUrl: 'dmProductionLaunchUrl',
  webManifestUrl: 'dmProductionWebManifestUrl', fullScopeUrl: 'dmProductionFullScopeUrl',
})) gradle = gradle.replaceAll(`"${oldName}"`, `"${newName}"`);
gradle = gradle.replace(/versionCode \d+/, `versionCode ${manifest.appVersionCode}`)
  .replace(/versionName "[^"]+"/, `versionName "${manifest.appVersionName}"`)
  .replace(/compileSdkVersion \d+/, 'compileSdkVersion 36')
  .replace(/targetSdkVersion \d+/, 'targetSdkVersion 36')
  .replace(/minSdkVersion \d+/, `minSdkVersion ${manifest.minSdkVersion}`)
  .replace(/com.google.androidbrowserhelper:billing:[^']+/, 'com.google.androidbrowserhelper:billing:1.2.0');
if (!gradle.includes(`hostName: '${manifest.host}'`)) throw new Error('Generated project host differs from the manifest.');
writeFileSync(gradleFile, gradle);
function run(command, args) {
  const result = spawnSync(command, args, { cwd: twa, env: buildEnv, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Android build or signature verification failed.');
}
run(join(twa, 'gradlew'), ['--no-daemon', '-Pandroid.useAndroidX=true', 'clean', 'bundleRelease', '--rerun-tasks']);
run('python3', [join(root, 'scripts/verify-production-twa.py'),
  join(twa, 'app/build/outputs/bundle/release/app-release.aab'), join(twa, 'twa-manifest.json')]);
const bundle = join(twa, `debate-master-production-v${manifest.appVersionName}-code${manifest.appVersionCode}.aab`);
run(join(jdk, 'bin/jarsigner'), ['-keystore', key,
  '-storepass:env', 'BUBBLEWRAP_KEYSTORE_PASSWORD', '-keypass:env', 'BUBBLEWRAP_KEY_PASSWORD',
  '-signedjar', bundle, join(twa, 'app/build/outputs/bundle/release/app-release.aab'), manifest.signingKey.alias]);
run(join(jdk, 'bin/jarsigner'), ['-verify', bundle]);
run('python3', [join(root, 'scripts/verify-production-twa.py'), bundle, join(twa, 'twa-manifest.json')]);
console.log(`Signed production bundle: ${bundle}`);
