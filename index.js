


const spawn = require('child_process').spawn;


var srcPath  = '/home/yvesmeili/Sites/zivi/local-photo-station/README.md';
var destPath = '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/test.md';
var cp = spawn('cp', [srcPath, destPath]);

cp.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

cp.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

cp.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});