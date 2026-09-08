const {spawn, spawnSync} = require('child_process');
const os = require('os');
const path = require('path');

const home = os.homedir();
const androidHome =
  process.env.ANDROID_HOME ||
  path.join(home, 'AppData', 'Local', 'Android', 'Sdk');
const emulatorPath = path.join(androidHome, 'emulator', 'emulator.exe');
const adbPath = path.join(androidHome, 'platform-tools', 'adb.exe');
const preferredAvd = process.env.ANDROID_AVD || 'SpeechToLive_API36';

const env = {
  ...process.env,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  PATH: [
    path.join(androidHome, 'platform-tools'),
    path.join(androidHome, 'emulator'),
    process.env.PATH || '',
  ].join(path.delimiter),
};

const listed = spawnSync(emulatorPath, ['-list-avds'], {
  env,
  encoding: 'utf8',
  shell: true,
});
const avds = (listed.stdout || '')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

if (avds.length === 0) {
  console.error('No AVD found.');
  process.exit(1);
}

const avdName = avds.includes(preferredAvd) ? preferredAvd : avds[0];
console.log(`Launching ${avdName}`);

const child = spawn(
  emulatorPath,
  ['-avd', avdName, '-allow-host-audio', '-netdelay', 'none', '-netspeed', 'full'],
  {
    env,
    detached: true,
    stdio: 'ignore',
  },
);
child.unref();

spawnSync(adbPath, ['wait-for-device'], {env, shell: true, stdio: 'inherit'});
spawnSync(adbPath, ['emu', 'avd', 'hostmicon'], {env, shell: true, stdio: 'ignore'});
console.log('Emulator started. Wait until the home screen is visible, then run npm run android.');
