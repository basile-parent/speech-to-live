const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_FILE = '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx';
const ARCHIVE_URL =
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/${MODEL_FILE}`;
const assetsDir = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'speaker-embedding',
);
const destination = path.join(assetsDir, MODEL_FILE);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, response => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          file.close();
          fs.unlinkSync(dest);
          download(response.headers.location, dest).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(assetsDir, {recursive: true});

  if (fs.existsSync(destination)) {
    console.log(`Speaker embedding model already present in ${destination}`);
    return;
  }

  console.log(`Downloading ${ARCHIVE_URL}`);
  await download(ARCHIVE_URL, destination);
  console.log(`Speaker embedding model installed in ${destination}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
