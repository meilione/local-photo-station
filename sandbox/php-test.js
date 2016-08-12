/*
* Testing the PHP Node Module
*/

/*
var execPhp = require('exec-php');

execPhp('php-filesorter/filesorter.php', function(error, php, outprint){
    console.log( error );
    console.log( php );
    console.log( outprint );
});

*/

var basepath      = '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.import-logs/';
var filelistpath  = basepath + 'importtask-1-12E4-0E1E-20160623_104031.log',
	outputfile    = basepath + 'import-processed.txt',
	ignorepath    = '/media/yvesmeili/12E4-0E1E/',
	pathseperator = '/';


const spawn = require('child_process').spawn;
const ls = spawn('php', ['php-filesorter/filesorter.php','--filelistpath='+filelistpath,'--outputfile='+outputfile,'--ignorePath='+ignorepath,'--pathseperator='+pathseperator]);

ls.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

ls.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

ls.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});