/*
* Photostation daemon
*/

//https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-centos-7

var FileImporter = require('./lib/import').ImportFiles;
var Tagger       = require('./lib/keyword-generator').keywordgenerator;
var Organizer    = require('./lib/file-organizer').fileorganizer;
var blockutils   = require('linux-blockutils');
var fs           = require('fs');
var moment       = require('moment');
var md5          = require('js-md5');


//Watch USB Port

var logFilePath = '/home/yvesmeili/Sites/zivi/local-photo-station/daemon.log';
var importIsRunning = false;
var baseLineUSBDevicesPlugged;
var knownUSBDevices = [];
var runningIntervalId;

var baseDirectoryDest = '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/';

var settings = {
	filePath : {
		media : {
			src  : '',
			dest : baseDirectoryDest + '.imported-waiting/',
			final : baseDirectoryDest + 'imported/'
		},
		logs : {
			fileList : baseDirectoryDest + '.imported-waiting/',
			errors   : baseDirectoryDest + '.imported-waiting/importerrors.log'
		}
	},
	importFilter : {
		ignoreDevices : ['sda','loop0'],
		minPathLength : 5
	}
}

/*
* Start Process
*/
//get baseline
getDevices(function (devices) {
	console.log( "Initial devices: ", devices );
	baseLineUSBDevicesPlugged = md5(devices.toString());
	console.log('baseline: ' + baseLineUSBDevicesPlugged);
	run();
});

//start watcher
function run() {
	runningIntervalId = setInterval(watch, 10000);
}

function watch() {
	//console.log("Usb Devices:\n", usbmonitor.list());
	getDevices(function (devices) {
		//console.log( devices );
		var usbPlugChanged = md5(devices.toString()) != baseLineUSBDevicesPlugged;
		if (usbPlugChanged && !importIsRunning) {
			importIsRunning = true;
			console.log('USB Changed');

			devices.forEach(function (device) {
				knownUSBDevices.push(md5(device.toString()));
			});
			
			console.log( knownUSBDevices );

			//Run import

			//TODO how to prevent duplicate import? lock usb mount name for 1h?


			var Importer = new FileImporter(settings, importFinished);
			Importer.start(devices);
		}
	});

}


function importFinished() {
	importIsRunning = false;

	console.log('Running the Tagger now');
	//TODO maybe start this as a separate process
	//Start Tagging
	var tagger = new Tagger(taggingFinished);
	tagger.start();

}


function taggingFinished() {
	//move files to date folders
	console.log('Moving the files to folders');
	var organizer = new Organizer(settings);
	organizer.start();
}


function getDevices(callback) {
	var ignoredDevices = ['sda','loop0'].join('|');
	blockutils.getBlockInfo({"ignoredev":"^("+ ignoredDevices +")"}, function (err,json){
		if (err) {
			return false;
		}

		callback(json);

	});
}

function logEvent(message) {
	var logMessage = moment().format() + ' ' + message + "\n";
	console.log(logMessage);
	fs.appendFile(logFilePath, logMessage, function(err) {
	    if(err) {
	        return console.error(err);
	    }
	}); 
}
