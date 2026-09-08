const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = os.homedir();
const projectRoot = path.join(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const outputDir = path.join(projectRoot, 'build');
const gradleAppOut = path.join(
  home,
  '.speech-to-live',
  'gradle-build',
  'app',
  'outputs',
  'apk',
);

const javaHome =
  process.env.JAVA_HOME ||
  'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.8-hotspot';
const androidHome =
  process.env.ANDROID_HOME ||
  path.join(home, 'AppData', 'Local', 'Android', 'Sdk');

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(home, '.gradle'),
  PATH: [
    path.join(javaHome, 'bin'),
    path.join(androidHome, 'platform-tools'),
    path.join(androidHome, 'cmdline-tools', 'latest', 'bin'),
    process.env.PATH || '',
  ].join(path.delimiter),
};

const REQUIRED_ASSETS = [
  path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'assets',
    'sherpa-onnx-streaming-zipformer-fr-kroko-2025-08-06',
    'encoder.onnx',
  ),
  path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'assets',
    'speaker-embedding',
    '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx',
  ),
];

function parseArgs(argv) {
  let variant = 'release';
  let architectures = 'arm64-v8a';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--debug') {
      variant = 'debug';
      continue;
    }
    if (arg === '--release') {
      variant = 'release';
      continue;
    }
    if (arg === '--arch' || arg === '--architectures') {
      architectures = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--arch=') || arg.startsWith('--architectures=')) {
      architectures = arg.split('=').slice(1).join('=');
    }
  }

  return {variant, architectures};
}

function ensureModels() {
  const missing = REQUIRED_ASSETS.filter(filePath => !fs.existsSync(filePath));
  if (missing.length === 0) {
    return;
  }

  console.error('Missing offline model assets. Download them first:');
  console.error('  npm run download:model:fr');
  console.error('  npm run download:model:speaker');
  console.error('Missing files:');
  for (const filePath of missing) {
    console.error(`  - ${filePath}`);
  }
  process.exit(1);
}

function runGradle(args) {
  const command = ['gradlew.bat', ...args]
    .map(part => (/\s/.test(part) ? `"${part}"` : part))
    .join(' ');

  return spawnSync(command, {
    env,
    cwd: androidDir,
    stdio: 'inherit',
    shell: true,
  });
}

function findBuiltApk(variant) {
  const candidates = [
    path.join(gradleAppOut, variant, `app-${variant}.apk`),
    path.join(gradleAppOut, variant, `app-${variant}-unsigned.apk`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const variantDir = path.join(gradleAppOut, variant);
  if (!fs.existsSync(variantDir)) {
    return null;
  }

  const apk = fs
    .readdirSync(variantDir)
    .filter(name => name.endsWith('.apk'))
    .map(name => path.join(variantDir, name))
    .sort(
      (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
    )[0];

  return apk || null;
}

function main() {
  const {variant, architectures} = parseArgs(process.argv.slice(2));
  ensureModels();

  fs.mkdirSync(outputDir, {recursive: true});

  const gradleTask =
    variant === 'debug' ? 'app:assembleDebug' : 'app:assembleRelease';

  console.log(
    `Building ${variant} APK for ${architectures} (shareable copy → build/)...`,
  );

  const result = runGradle([
    gradleTask,
    `-PreactNativeArchitectures=${architectures}`,
  ]);

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const builtApk = findBuiltApk(variant);
  if (!builtApk) {
    console.error(`Could not find built APK under ${gradleAppOut}/${variant}`);
    process.exit(1);
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const fileName = `SpeechToLive-${variant}-${stamp}.apk`;
  const destination = path.join(outputDir, fileName);

  fs.copyFileSync(builtApk, destination);

  const latestName =
    variant === 'debug' ? 'SpeechToLive-debug.apk' : 'SpeechToLive-release.apk';
  const latestPath = path.join(outputDir, latestName);
  fs.copyFileSync(builtApk, latestPath);

  console.log('APK ready:');
  console.log(`  ${destination}`);
  console.log(`  ${latestPath}`);
}

main();
