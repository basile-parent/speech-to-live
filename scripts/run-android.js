const {spawn, spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = os.homedir();
const projectRoot = path.join(__dirname, '..');
const javaHome =
  process.env.JAVA_HOME ||
  'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.8-hotspot';
const androidHome =
  process.env.ANDROID_HOME ||
  path.join(home, 'AppData', 'Local', 'Android', 'Sdk');
const adbPath = path.join(androidHome, 'platform-tools', 'adb.exe');
const emulatorPath = path.join(androidHome, 'emulator', 'emulator.exe');
const preferredAvd = process.env.ANDROID_AVD || 'SpeechToLive_API36';
const bootTimeoutMs = Number(process.env.ANDROID_BOOT_TIMEOUT_MS || 300000);
const appId = 'com.speechtolive.app';
const launchActivity = 'com.speechtolive.app.MainActivity';

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(home, '.gradle'),
  PATH: [
    path.join(javaHome, 'bin'),
    path.join(androidHome, 'platform-tools'),
    path.join(androidHome, 'emulator'),
    path.join(androidHome, 'cmdline-tools', 'latest', 'bin'),
    process.env.PATH || '',
  ].join(path.delimiter),
};

function parseArgs(argv) {
  const args = [...argv];
  let deviceId = null;
  const passthrough = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--device' || arg === '--deviceId' || arg === '-d') {
      deviceId = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--device=') || arg.startsWith('--deviceId=')) {
      deviceId = arg.split('=').slice(1).join('=');
      continue;
    }
    passthrough.push(arg);
  }

  return {deviceId, passthrough};
}

function run(command, args, options = {}) {
  const useShell = options.shell ?? true;
  return spawnSync(command, args, {
    env,
    encoding: 'utf8',
    ...options,
    shell: useShell,
  });
}

function runGradle(args) {
  const androidDir = path.join(projectRoot, 'android');
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

function sleep(ms) {
  spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`],
    {stdio: 'ignore', shell: false},
  );
}

function listDevices() {
  const result = run(adbPath, ['devices']);
  return (result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(1)
    .map(line => {
      const [id, status] = line.split(/\s+/);
      return {id, status};
    })
    .filter(device => device.id);
}

function isEmulatorId(deviceId) {
  return deviceId.startsWith('emulator-');
}

function isDeviceBooted(deviceId) {
  const boot = run(adbPath, ['-s', deviceId, 'shell', 'getprop', 'sys.boot_completed']);
  return (boot.stdout || '').trim() === '1';
}

function getDeviceAbi(deviceId) {
  const result = run(adbPath, [
    '-s',
    deviceId,
    'shell',
    'getprop',
    'ro.product.cpu.abi',
  ]);
  const abi = (result.stdout || '').trim();
  if (abi === 'arm64-v8a' || abi === 'armeabi-v7a' || abi === 'x86_64' || abi === 'x86') {
    return abi;
  }
  return isEmulatorId(deviceId) ? 'x86_64' : 'arm64-v8a';
}

function isEmulatorRunning() {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      "if (Get-Process qemu-system-x86_64,emulator -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }",
    ],
    {encoding: 'utf8', shell: false},
  );
  return (result.stdout || '').trim() === 'yes';
}

function killEmulators() {
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Get-Process qemu-system-x86_64,emulator,crashpad_handler -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue',
    ],
    {stdio: 'ignore', shell: false},
  );
  sleep(2000);
}

function getOnlineDevices() {
  return listDevices().filter(device => device.status === 'device');
}

function pickPreferredOnlineDevice(requestedDeviceId) {
  const online = getOnlineDevices().filter(device => isDeviceBooted(device.id));
  if (requestedDeviceId) {
    const match = online.find(device => device.id === requestedDeviceId);
    if (!match) {
      throw new Error(
        `Requested device ${requestedDeviceId} is not online. Connected: ${
          online.map(device => device.id).join(', ') || 'none'
        }`,
      );
    }
    return match;
  }

  // Prefer a physical phone over an emulator when both are present.
  return (
    online.find(device => !isEmulatorId(device.id)) ||
    online[0] ||
    null
  );
}

function waitForBootedDevice(timeoutMs, requestedDeviceId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const devices = listDevices();
    if (devices.some(device => device.status === 'offline')) {
      console.log('Device offline, reconnecting adb...');
      run(adbPath, ['reconnect']);
      run(adbPath, ['kill-server']);
      run(adbPath, ['start-server']);
    }

    try {
      const selected = pickPreferredOnlineDevice(requestedDeviceId);
      if (selected) {
        return selected;
      }
    } catch (error) {
      // Keep waiting until timeout when a specific device was requested.
      if (!requestedDeviceId) {
        throw error;
      }
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log(`Waiting for device boot... ${elapsed}s`);
    sleep(5000);
  }
  return null;
}

function listAvds() {
  const result = run(emulatorPath, ['-list-avds']);
  return (result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function startEmulator(avdName) {
  console.log(`Starting emulator ${avdName}...`);
  const child = spawn(
    emulatorPath,
    [
      '-avd',
      avdName,
      '-allow-host-audio',
      '-netdelay',
      'none',
      '-netspeed',
      'full',
      '-no-snapshot-load',
      '-gpu',
      'auto',
    ],
    {
      env,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    },
  );
  child.unref();
}

function ensureDeviceReady(requestedDeviceId) {
  const existing = pickPreferredOnlineDevice(requestedDeviceId);
  if (existing) {
    console.log(`Using online device ${existing.id}`);
    return existing;
  }

  if (requestedDeviceId) {
    throw new Error(
      `Requested device ${requestedDeviceId} is not connected. Plug it in, enable USB debugging, then run: adb devices`,
    );
  }

  if (listDevices().some(device => device.status === 'offline') || isEmulatorRunning()) {
    console.log('Cleaning stale/offline emulator processes...');
    killEmulators();
    run(adbPath, ['kill-server']);
    run(adbPath, ['start-server']);
  }

  const avds = listAvds();
  if (avds.length === 0) {
    throw new Error(
      'No Android device/emulator found. Connect a phone via USB or create an AVD in Android Studio.',
    );
  }

  const avdName = avds.includes(preferredAvd) ? preferredAvd : avds[0];
  startEmulator(avdName);

  console.log(
    `Waiting up to ${Math.round(bootTimeoutMs / 1000)}s for emulator boot...`,
  );
  const device = waitForBootedDevice(bootTimeoutMs);
  if (!device) {
    throw new Error(
      `Emulator ${avdName} did not become online in time. Start it manually, wait for the home screen, then rerun npm run android.`,
    );
  }

  console.log(`Emulator ready: ${device.id}`);
  return device;
}

function installAndLaunch(deviceId) {
  const abi = getDeviceAbi(deviceId);
  console.log(`Building for ABI ${abi} and installing on ${deviceId}...`);

  const install = runGradle([
    'app:installDebug',
    `-PreactNativeArchitectures=${abi}`,
  ]);
  if ((install.status ?? 1) !== 0) {
    return install.status ?? 1;
  }

  console.log('Launching app...');
  const launch = run(
    adbPath,
    [
      '-s',
      deviceId,
      'shell',
      'am',
      'start',
      '-n',
      `${appId}/${launchActivity}`,
    ],
    {stdio: 'inherit', shell: false},
  );
  return launch.status ?? 1;
}

function main() {
  const {deviceId: requestedDeviceId} = parseArgs(process.argv.slice(2));

  fs.mkdirSync(path.join(home, '.speech-to-live', 'gradle-build'), {
    recursive: true,
  });

  run(adbPath, ['start-server']);
  const device = ensureDeviceReady(requestedDeviceId);

  if (isEmulatorId(device.id)) {
    run(adbPath, ['-s', device.id, 'emu', 'avd', 'hostmicon'], {
      stdio: 'ignore',
    });
  }

  const status = installAndLaunch(device.id);

  if (isEmulatorId(device.id)) {
    run(adbPath, ['-s', device.id, 'emu', 'avd', 'hostmicon'], {
      stdio: 'ignore',
    });
  }

  process.exit(status);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
