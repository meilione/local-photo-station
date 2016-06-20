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
var sqlite3     = require('sqlite3');



class ImportFiles {


	constructor(_settings, _dbConfig, _callback) {
		/*
		* Internal variables
		*/
		ImportFiles.maxBufferSizeMB = 64;
		ImportFiles.maxFileSizeMB   = 100;

		ImportFiles.devicePaths = [];

		ImportFiles.fileImportProgressBar;

		ImportFiles.dbConfig = '';
		ImportFiles.db;
		ImportFiles.currentImportID;
		ImportFiles.startDate;
		ImportFiles.fileListHash;

		/*
		* External accesible variables
		*/
		var callback = function () {};
		var settings = {
			filePath : {
				media : {
					src  : '',
					dest : ''
				},
				logs : {
					fileList : '',
					errors   : ''
				}
			},
			importFilter : {
				ignoreDevices : ['sda','loop0'],
				minPathLength : 5
			}
		}

		ImportFiles.dbConfig = _dbConfig;

		this.settings = Object.assign(settings,_settings);

		this.importErrors = [];
		this.importedFiles = [];


		this.limitFileImportTo = 0;


		if (_callback) {
			this.callback = _callback;
		}

		//Sanity Checks
		if (this.settings.filePath.media.dest === '') {
			console.error("No destination path specified");
			return;
		}
	}


	start(usbdevice) {
		var self = this;

		ImportFiles.startDate = new Date();
		ImportFiles.db = new sqlite3.Database(ImportFiles.dbConfig.file);

		if (usbdevice && usbdevice.length >= 1) {
			usbdevice.forEach(function (el) {
				ImportFiles.devicePaths.push(el.MOUNTPOINT);
			});
			self.processUSBDevices();
		} else {
			this.getUSBDevices().then(function (response) {
				self.processUSBDevices();
			}).catch(function (error) {
				console.error('Could not load USB Devices ' + error);
			});
		}
	}

	finish() {
		//TODO not currently running completely at the end of the script as db calls might be still running

		console.log("Import finished");

		this.callback();

		//this is to close the db, should run after all calls have finished
		//ImportFiles.db.close();
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
		var self = this;

		if (device.length <= this.settings.importFilter.minPathLength) {
			console.error('Given device ('+ device +') does not seem to be a valid path');
			return false;
		}

		exec("find " + device + " -type f -exec file {} \\; | awk -F: '{if ($2 ~/image/) print $1}'", {maxBuffer: 1024 * 1024 * ImportFiles.maxBufferSizeMB} , (error,stdout,stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				return;
			}

			//PREVENT possible duplicate import
			ImportFiles.fileListHash = md5(device + stdout);

			this.isNotDuplicateImport(ImportFiles.fileListHash)
				.then(function () {
					self.processFileList(device,stdout);
				});
		});
	}


	isNotDuplicateImport(checkHash) {
		return new Promise(function (resolve, reject) {

			ImportFiles.db.serialize(function () {
			ImportFiles.db.all("SELECT * FROM imports WHERE filelisthash = $hash", 
				{
					$hash : checkHash
				},
				function (err,rows) {
				if (err) {
					console.error(err);
					reject();
					return false;
				}

				if (rows.length > 0) {
					console.error('Import already exists');
					reject();
					return false;
				}

				resolve( true );

			});
			});

		});
	}


	processFileList(device,fileList) {
		var self = this;
		var fileListArr = fileList.split(`\n`);
		var filesNo = fileListArr.length;

		if (filesNo <= 0) {
			console.error('No files found to import');
			return false;
		}

		//Save log
		this.getImportID(device,filesNo, function proceedWithImport(importID) {

			self.saveFileListToDisk(fileList, device, importID);

			//FOR TESTING
			if (self.limitFileImportTo > 0) {
				fileListArr = fileListArr.splice(0,self.limitFileImportTo);
			}

			//show progress bar
			self.fileImportProgressBar = new ProgressBar('  Importing [:bar] :percent :etas', {
														total: fileListArr.length,
														complete: '=',
														incomplete: ' ',
														width: 60
													});

			self.copyAll(fileListArr).then(function (results) {
				//console.log("Sucess: " + results);
				self.copyComplete(self);
			}, function (err) {
				console.error("Following error occured: " + err);
			});
			

		});

	}

	copyAll(files) {
		return Promise.all(files.map(this.importFile,this));
	}


	importFile(filePath) {
		var self = this;

		return new Promise(function(resolve, reject){
			if (!self.sourceFileIsValid(filePath)) {
				self.importErrors.push({
										filename: filePath, 
										error: "Source file not valid", 
										errorMessage:''});
				resolve();
				return false;
			}

			var uniqueFileName = self.createUniqueFileName(filePath);

			var fileSrc  = filePath;
			var fileDest = self.settings.filePath.media.dest + uniqueFileName;
			//self.copyFile(fileSrc,fileDest,resolve,reject);

			//copy file
			var readStream  = fs.createReadStream(fileSrc),
	    		writeStream = fs.createWriteStream(fileDest, {autoClose: true});

	    	readStream.on('error', function (err) {
	    		self.importErrors.push({
										filename: fileSrc, 
										error: "Can't read file from source", 
										errorMessage:err});
	    		reject();
	    	});
			writeStream.on('error', function (err) {
	    		self.importErrors.push({
										filename: fileSrc, 
										error: "Can't open new file at dest", 
										errorMessage:err});
	    		reject();
	    	});

			writeStream.on('open', function() {
		    	readStream.pipe(writeStream);
		    });

			writeStream.once('finish', function() {
				self.importedFiles.push( { 
									  src:  fileSrc, 
									  dest: fileDest
									} );
				self.fileImportProgressBar.tick();
				resolve();
			});

		});

	}


	copyComplete(self) {
		//Log
		//console.log( self.importedFiles );
		console.log( "Import Errors: " + self.importErrors );

		//save to db
		//save individual files
		//TODO properly resolve all updates in forEach
		var dbFilesUpdated = new Promise(function(resolve, reject){
			ImportFiles.db.parallelize(function () {
				console.log("Inserting files");
				//TODO optimie as this takes a a ver long time
				self.importedFiles.forEach(function (file) {
					ImportFiles.db.run("INSERT INTO imported_files (importID,src,dest,status) VALUES ($importid,$src,$dest,$status)", {
						$importid: ImportFiles.currentImportID,
						$src: file.src,
						$dest: file.dest,
						$status: 'imported'
					}, function (err) {
						if (err) {
							console.log("Error occured while trying to insert file");
							self.importErrors.push({filename:'',error:"Can't insert file import: " + file.src + " DEST: " + file.dest});
						}
						resolve(true);
					});
				});
			});
		});

		//save end time and import stats
		var dbImportsUpdated = new Promise(function(resolve, reject){
			ImportFiles.db.serialize(function () {
				console.log("Updating imports");
				ImportFiles.db.run("UPDATE imports SET end = $end, filelisthash = $hash, filesOut = $files, status = $status WHERE ID = $importid", {
					$importid: ImportFiles.currentImportID,
					$hash: ImportFiles.fileListHash,
					$end: moment().format(),
					$files: self.importedFiles.length,
					$status: 'imported'
				}, function (err) {
					if (err) {
						console.log("Error occured while trying to update imports");
						self.importErrors.push({filename:'',error:"Can't update database import enddate and filecount"});
					}
					resolve(true);

				});
			});
		});

		Promise.all([dbFilesUpdated,dbImportsUpdated])
			   .then(function () {
			   		self.finish();
			   	});

		if (self.importErrors.length > 0) {
			console.log("Logging errors");
			self.saveErrorLog();
		}

		//self.finish();
	}


	saveErrorLog() {
		var logFilePath = this.settings.filePath.logs.errors;
		if (logFilePath.length <= 5) {
			return false;
		}

		var errorTxt = '';

		this.importErrors.forEach(function (err) {
			errorTxt += moment().format() + ' ' + err.filename + ' ' + err.error + '\n';
		});

		fs.appendFile(logFilePath, errorTxt, function(err) {
		    if(err) {
		        return console.error(err);
		    }
		}); 
	}


	getImportID(device,filesNo,callback) {

		var deviceName  = path.basename(device);

		//save to db
		ImportFiles.db.serialize(function () {
			ImportFiles.db.run("INSERT INTO imports (name,start,end,filesIn,status) VALUES ($name,$start,$end,$files,$status)", {
		    	$name:    deviceName,
		    	$start:   moment(ImportFiles.startDate).format(),
		    	$end:     '',
		    	$files:   filesNo,
		    	$status:  'importing'
		    }, function () {
		    	ImportFiles.currentImportID = this.lastID;
		    	callback(this.lastID);
		    });
		});

	}


	saveFileListToDisk(fileListTxt, device, importid) {
		if (fileListTxt.length <= this.settings.importFilter.minPathLength) {
			return false;
		}

		var deviceName  = path.basename(device);
		var logFilePath = this.settings.filePath.logs.fileList + 'importtask-' + importid + '-' + deviceName + '-' + moment(ImportFiles.startDate).format("YYYYMMDD_Hmmss") + '.log';

		fs.writeFile(logFilePath, fileListTxt, function(err) {
		    if(err) {
		        return console.error(err);
		    }
		}); 

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
			this.importErrors.push({filename: filePath, error:'File is not readable'});
			//console.error(err);
			return false;
		}

		var fileSizeBytes = stats['size'];
		var maxFileSizeBytes = ImportFiles.maxFileSizeMB * 1024 * 1024;

		//Check if file is larger than max size
		if (fileSizeBytes > maxFileSizeBytes) {
			this.importErrors.push({
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

module.exports.ImportFiles = ImportFiles;

