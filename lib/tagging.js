/*
* Tagging
*/

const exec = require('child_process').exec;

var maxBufferSizeMB = 64;

var destinationFolder = '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/';


var imageFile = '/mnt/digitalassetmanagement/Test-Import/General\\ Tests/dummy-480x270-Butterfly.jpg';

var keywords = ['some new keywords 1', 'super'];

var keywordList = ''
keywords.forEach(function (el) {
	keywordList += ' -keywords+="'+ el +'"';
});



exec('exiftool ' + imageFile + ' ' + keywordList + ' -overwrite_original', {maxBuffer: 1024 * 1024 * maxBufferSizeMB} , (error,stdout,stderr) => {

	if (error) {
		console.error(`exec error: ${error}`);
		return;
	}

	console.log( stdout );

});
