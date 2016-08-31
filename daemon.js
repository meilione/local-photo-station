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
* http://pm2.keymetrics.io/
*/

var FileImporter = require('./lib/import').ImportFiles;
var blockutils   = require('linux-blockutils');
var fs           = require('fs');
var moment       = require('moment');
var md5          = require('js-md5');
var config       = require('config');
var Audioplayer = require('./lib/audio-player.js').AudioPlayer;


//Watch USB Port
var logFilePath = config.get('global.filesystem.filePath.logs.fileList') + 'daemon.log';
var importIsRunning = false;
var baseLineUSBDevicesPlugged;
var resetToUSBBaseLine;
var knownUSBDevices = [];
var runningIntervalId;
var dbConfig = config.get('global.dbConfig');

var Audio = new Audioplayer();

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
	getDevices(function (devices) {
		//console.log( devices );
		console.log(' . ');
		var usbPlugChanged = md5(devices.toString()) != baseLineUSBDevicesPlugged;
		if (usbPlugChanged && !importIsRunning) {
			//resetToUSBBaseLine = baseLineUSBDevicesPlugged;
			baseLineUSBDevicesPlugged = md5(devices.toString());

			importIsRunning = true;
			console.log('USB Changed');
			Audio.play('gling');

			devices.forEach(function (device) {
				knownUSBDevices.push(md5(device.toString()));
			});
			
			console.log( knownUSBDevices );

			//Run import
			var settings = {'global' : config.get('global'), 'local' : config.get('module.importer') };
			var Importer = new FileImporter(settings, dbConfig, importFinished);
			Importer.activateTagger(true);
			Importer.playSounds = true;
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
	console.log('Import Daemon finished');
	importIsRunning = false;
	//baseLineUSBDevicesPlugged = resetToUSBBaseLine;
	Audio.success();
}


function getDevices(callback) {
	var ignoredDevices = config.get('module.importer.importFilter.ignoreDevices').join('|');
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
