const fs = require('fs');
const path = require('path');
const https = require('https');
const {execFileSync} = require('child_process');

const MODEL_NAME = 'sherpa-onnx-streaming-zipformer-fr-2023-04-14';
const ARCHIVE_URL =
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_NAME}.tar.bz2`;
const assetsDir = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  MODEL_NAME,
);
const archivePath = path.join(__dirname, `${MODEL_NAME}.tar.bz2`);

const requiredFiles = [
  'encoder-epoch-29-avg-9-with-averaged-model.int8.onnx',
  'decoder-epoch-29-avg-9-with-averaged-model.onnx',
  'joiner-epoch-29-avg-9-with-averaged-model.onnx',
  'tokens.txt',
];

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, response => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          file.close();
          fs.unlinkSync(destination);
          download(response.headers.location, destination).then(resolve).catch(reject);
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

  const alreadyPresent = requiredFiles.every(fileName =>
    fs.existsSync(path.join(assetsDir, fileName)),
  );
  if (alreadyPresent) {
    console.log(`Model already present in ${assetsDir}`);
    return;
  }

  console.log(`Downloading ${ARCHIVE_URL}`);
  await download(ARCHIVE_URL, archivePath);

  const extractRoot = path.join(__dirname, 'tmp-model');
  fs.rmSync(extractRoot, {recursive: true, force: true});
  fs.mkdirSync(extractRoot, {recursive: true});

  execFileSync('tar', ['xjf', archivePath, '-C', extractRoot], {stdio: 'inherit'});

  const extractedDir = path.join(extractRoot, MODEL_NAME);
  for (const fileName of requiredFiles) {
    const source = path.join(extractedDir, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing expected model file: ${fileName}`);
    }
    fs.copyFileSync(source, path.join(assetsDir, fileName));
  }

  fs.rmSync(extractRoot, {recursive: true, force: true});
  fs.rmSync(archivePath, {force: true});
  console.log(`French streaming model installed in ${assetsDir}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
