/*
* Name:   Photostation daemon
* Date:   2016-06-01
* Author: Yves Meili <meili@kitakit.ch>
*
* The daemon will discover any newly plugged USB thumb drive and auto-
* matically process with the import, tagging and organizing of the files.
*
* In order to run this script as a daemon use the following command:
*
*  pm2 start daemon.js
*
* This will start a daemon process that the can be monitored by the 
* pm2 tool with the following command:
*
*  pm2 info <id>
*
* See documentation at: https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-centos-7
*/

var FileImporter = require('./lib/import').ImportFiles;
var Tagger       = require('./lib/keyword-generator').keywordgenerator;
var Organizer    = require('./lib/file-organizer').fileorganizer;
var blockutils   = require('linux-blockutils');
var fs           = require('fs');
var moment       = require('moment');
var md5          = require('js-md5');
var config       = require('config');


//Watch USB Port
var logFilePath = '/home/yvesmeili/Sites/zivi/local-photo-station/daemon.log';
var importIsRunning = false;
var baseLineUSBDevicesPlugged;
var knownUSBDevices = [];
var runningIntervalId;
var dbConfig = config.get('global.dbConfig');


/*
* Start Process
*/
//get baseline
getDevices(function (devices) {
	console.log( "Initial devices: " + devices.toString() );
	baseLineUSBDevicesPlugged = md5(devices.toString());
	console.log('baseline: ' + baseLineUSBDevicesPlugged);
	run();
});

//start watcher
function run() {
	var watchInterval = 10000;
	if (config.has('daemon.watchInterval')) {
		watchInterval = config.get('daemon.watchInterval');
	}
	console.log("Watch interval at: " + (watchInterval/1000) + "s");
	runningIntervalId = setInterval(watch, watchInterval);
}

function watch() {
	//console.log("Usb Devices:\n", usbmonitor.list());
	getDevices(function (devices) {
		//console.log( devices );
		var usbPlugChanged = md5(devices.toString()) != baseLineUSBDevicesPlugged;
		if (usbPlugChanged && !importIsRunning) {
			baseLineUSBDevicesPlugged = md5(devices.toString());

			importIsRunning = true;
			console.log('USB Changed');

			devices.forEach(function (device) {
				knownUSBDevices.push(md5(device.toString()));
			});
			
			console.log( knownUSBDevices );

			//Run import
			//TODO how to prevent duplicate import? lock usb mount name for 1h?
			//TODO maybe start this as a separate process
			var settings = config.get('global.filesystem');
			var Importer = new FileImporter(settings, dbConfig, importFinished);

			if (config.has('debug.importFileLimit')) {
				var limitFilesTo = config.get('debug.importFileLimit');
				if (limitFilesTo > 0) {
					console.log('limiting to: ' + limitFilesTo);
					Importer.limitFileImportTo = limitFilesTo;
				}
			}
			Importer.start();

		}
	});

}


function importFinished() {
	console.log('Running the Tagger now');
	//Start Tagging
	var settings = Object.assign( config.get('global.filesystem'), config.get('module.tagger') );
	var tagger = new Tagger(settings, dbConfig, taggingFinished);
	tagger.start();

}


function taggingFinished() {
	//move files to date folders
	console.log('Moving the files to folders');
	var settings = Object.assign( config.get('global.filesystem'), config.get('module.organizer') );
	var organizer = new Organizer(settings, organizerFinished);
	organizer.start();

	importIsRunning = false;
}


function organizerFinished() {
	console.log('Organizer finished');
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
