const fs = require('fs');
const os = require('os');
const path = require('path');

function rm(target) {
  fs.rmSync(target, {recursive: true, force: true});
  console.log(`Removed ${target}`);
}

const home = os.homedir();
const projectRoot = path.join(__dirname, '..');

rm(path.join(projectRoot, 'android', 'app', 'build'));
rm(path.join(projectRoot, 'android', 'app', '.cxx'));
rm(path.join(projectRoot, 'android', 'build'));
rm(path.join(home, '.speech-to-live', 'gradle-build', 'app'));
