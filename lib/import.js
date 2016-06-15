/*
* Importing
*/

const spawn     = require('child_process').spawn;
const exec      = require('child_process').exec;
var fs          = require('fs');
var path        = require('path');
var blockutils  = require('linux-blockutils');
var md5         = require('js-md5');
var ProgressBar = require('progress');
var moment      = require('moment');


var settings = {
	filePath : {
		media : {
			src  : '',
			dest : '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/'
		},
		logs : {
			fileList : '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/',
			errors   : ''
		}
	},
	importFilter : {
		ignoreDevices : ['sda','loop0'],
		minPathLength : 5
	}
}



class ImportFiles {


	constructor(_settings) {
		/*
		* Internal variables
		*/
		ImportFiles.maxBufferSizeMB = 64;
		ImportFiles.maxFileSizeMB   = 100;

		ImportFiles.devicePaths = [];

		ImportFiles.fileImportProgressBar;

		/*
		* External accesible variables
		*/
		this.settings = _settings;

		this.importErrors = [];
		this.importedFiles = [];
	}


	start() {
		var self = this;
		this.getUSBDevices().then(function (response) {
			self.processUSBDevices();
		}).catch(function (error) {
			console.error('Could not load USB Devices ' + error);
		});
	}


	getUSBDevices() {
		var self = this;
		return new Promise(function (resolve, reject) {

			var ignoredDevices = self.settings.importFilter.ignoreDevices.join('|');

			blockutils.getBlockInfo({"ignoredev":"^("+ ignoredDevices +")"}, function (err,json){
				if (err) {
					reject("Error: " + err);
					return false;
				}
				
				if (json.length === 0) {
					reject('No devices found');
					return false;
				}

				json.forEach(function (el) {
					ImportFiles.devicePaths.push(el.MOUNTPOINT);
				});

				resolve(ImportFiles.devicePaths);

			});

		});
	}


	processUSBDevices() {
		var availableDevices = ImportFiles.devicePaths;
		for (var i=0, len=availableDevices.length; i<len; i++) {
			this.readFileList(availableDevices[i]);
		}
	}


	readFileList(device) {
		if (device.length <= this.settings.importFilter.minPathLength) {
			console.error('Given device ('+ device +') does not seem to be a valid path');
			return false;
		}

		exec("find " + device + " -type f -exec file {} \\; | awk -F: '{if ($2 ~/image/) print $1}'", {maxBuffer: 1024 * 1024 * ImportFiles.maxBufferSizeMB} , (error,stdout,stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				return;
			}
			this.processFileList(device,stdout);
		});
	}


	processFileList(device,fileList) {
		var self = this;
		var fileListArr = fileList.split(`\n`);

		//Save log
		this.saveFileListToDisk(fileList, device);

		//FOR TESTING
		fileListArr = fileListArr.splice(0,3);

		this.fileImportProgressBar = new ProgressBar('  Importing [:bar] :percent :etas', {
													total: fileListArr.length,
													complete: '=',
													incomplete: ' ',
													width: 60
												});

		fileListArr.forEach(function (filePath) {
			self.importFile(filePath);
		});

	}


	saveFileListToDisk(fileListTxt, device) {
		if (fileListTxt.length <= this.settings.importFilter.minPathLength) {
			return false;
		}

		var deviceName = path.basename(device);
		var logFilePath = this.settings.filePath.logs.fileList + 'import-' + deviceName + '-' + moment().format("YYYYMMDD_Hmmss") + '.log';

		fs.writeFile(logFilePath, fileListTxt, function(err) {
		    if(err) {
		        return console.error(err);
		    }
		}); 

	}


	importFile(filePath) {
		var self = this;

		if (!self.sourceFileIsValid(filePath)) {
			return false;
		}

		var uniqueFileName = self.createUniqueFileName(filePath);

		var fileSrc  = filePath;
		var fileDest = self.settings.filePath.media.dest + uniqueFileName;
		self.copyFile(fileSrc,fileDest);

	}


	sourceFileIsValid(filePath) {
		//directory operator
		if (['.','..'].indexOf(filePath) !== -1) {
			return false;
		}

		//empty
		if (filePath.length <= this.settings.importFilter.minPathLength) {
			return false;
		}

		//get stats test file
		try {
			var stats = fs.statSync(filePath);
		} catch (err) {
			self.importErrors.push({filename: filePath, error:'File is not readable'});
			//console.error(err);
			return false;
		}

		var fileSizeBytes = stats['size'];
		var maxFileSizeBytes = ImportFiles.maxFileSizeMB * 1024 * 1024;

		//Check if file is larger than max size
		if (fileSizeBytes > maxFileSizeBytes) {
			self.importErrors.push({
									filename: filePath, 
									error:'Exceeds size limit', 
									errorMessage:'File larger than '+ maxFileSizeMB +'MB '});
			//console.error('File larger than '+ maxFileSizeMB +'MB ');
			return false;
		}

		return true;
	}


	createUniqueFileName(filePath) {
		//create unique name
		//var birthtime = stats['birthtime'];
		var hashFileName = md5(filePath);
		var ext = path.extname(filePath).toLowerCase();
		return hashFileName + ext;
	}


	copyFile(src,dest) {
		var self = this;

		//copy file
		var readStream  = fs.createReadStream(src),
    		writeStream = fs.createWriteStream(dest, {autoClose: true});

    	readStream.on('error', function (err) {
    		self.importErrors.push({
									filename: src, 
									error: "Can't read file from source", 
									errorMessage:err});
    	});
		writeStream.on('error', function (err) {
    		self.importErrors.push({
									filename: src, 
									error: "Can't open new file at dest", 
									errorMessage:err});
    	});

		writeStream.on('open', function() {
	    	readStream.pipe(writeStream);
	    });

		writeStream.once('finish', function() {
			self.importedFiles.push( { 
								  src:  src, 
								  dest: dest
								} );
			self.fileImportProgressBar.tick();
		});

	}


	findDuplicates(arr) {
		var sorted_arr = arr.slice().sort(); // You can define the comparing function here. 
		                                     // JS by default uses a crappy string compare.
		                                     // (we use slice to clone the array so the original array won't be modified)
		var results = [];
		for (var i = 0; i < arr.length - 1; i++) {
		    if (sorted_arr[i + 1] == sorted_arr[i]) {
		        results.push(sorted_arr[i]);
		    }
		}
		return results;
	}



}


var Importer = new ImportFiles(settings);
Importer.start();

