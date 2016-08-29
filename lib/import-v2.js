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
var mkdirp      = require('mkdirp');
var ExifTag     = require('./tag-file.js').tagfile;
var ExifImage   = require('exif').ExifImage;

var ImageDuplicate = require('./image-duplicates.js').ImageDuplicate;
var USBHandling  = require('./usb-handler.js').USBHandling;

var async       = require('async');
var unique      = require('array-unique');



class ImportFiles {


	constructor(_settings, _dbConfig, _callback) {
		/*
		* Internal variables
		*/
		ImportFiles.maxBufferSizeMB = 64;
		ImportFiles.maxFileSizeMB   = 50;
		ImportFiles.asyncLimit      = 1000;

		ImportFiles.devicePaths = [];

		ImportFiles.fileImportProgressBar;

		ImportFiles.dbConfig = '';
		ImportFiles.db;
		ImportFiles.currentImportID;
		ImportFiles.startDate;
		ImportFiles.fileListHash;

		ImportFiles.currentDevice = '';

		ImportFiles.isLocalImport = false;

		ImportFiles.currentInstance;

		ImportFiles.USBHandling;
		ImportFiles.tagfile;
		ImportFiles.taggerFileparts = false;
		ImportFiles.handleDuplicates = 'ignore'; //ignore, overwrite, rename

		ImportFiles.runTagger = false;

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
			ImportFiles.callback = _callback;
		}

		//Sanity Checks
		if (this.settings.filePath.media.dest === '') {
			console.error("No destination path specified");
			return;
		}
	}


	start(usbdevice,filepath) {
		var self = this;
		ImportFiles.currentInstance = this;

		ImportFiles.startDate = new Date();
		ImportFiles.db = new sqlite3.Database(ImportFiles.dbConfig.file);
		ImportFiles.tagfile = new ExifTag(ImportFiles.dbConfig);

		ImportFiles.Imgdup = new ImageDuplicate(ImportFiles.dbConfig);

		ImportFiles.USBHandling = new USBHandling();


		//TODO
		ImportFiles.USBHandling.setIgnoredDevices(self.settings.importFilter.ignoreDevices);

		//if filepath is set this has precedence over usb
		if (filepath && filepath.length >= 1) {
			console.log('Using file path: ' + filepath);
			ImportFiles.isLocalImport = true;
			self.readFileList(filepath);
			return;
		}

		if (usbdevice && usbdevice.length >= 1) {
			usbdevice.forEach(function (el) {
				ImportFiles.devicePaths.push(el.MOUNTPOINT);
			});
			self.processUSBDevices();
		} else {
			//this.getUSBDevices()
			ImportFiles.USBHandling.getUSBDevices.then(function (devices) {
				self.ImportFiles.devicePaths = devices;
				self.processUSBDevices();
			}).catch(function (error) {
				console.error('Could not load USB Devices ' + error);
				self.finish();
			});
		}
	}


	finish() {
		console.log("Import finished");
		ImportFiles.currentInstance.db.close();
		ImportFiles.currentInstance.callback();
	}


	activateTagger(_doit) {
		if (_doit === false) {
			return;
		}

		ImportFiles.runTagger = true;
	}


	setTaggerSettings(_fileparts) {
		if (_fileparts === true || _fileparts === false) {
			ImportFiles.taggerFileparts = _fileparts;
		}
	}


	setMaxParallelExecutions(_maxExec) {
		if (_maxExec && _maxExec > 10) {
			ImportFiles.asyncLimit = _maxExec;
		}
	}


	setDuplicateMode(_handling = 'ignore') {
		//console.log('Conflict handling: ' + _handling);
		ImportFiles.handleDuplicates = _handling;
	}

	/*
	//Moved to usb-handler.js
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
					if (el.MOUNTPOINT === '' && el.PARTITIONS) {
						el.PARTITIONS.forEach(function (part) {
							ImportFiles.devicePaths.push(part.MOUNTPOINT);
						});
					} else {
						ImportFiles.devicePaths.push(el.MOUNTPOINT);
					}
				});

				resolve(ImportFiles.devicePaths);

			});

		});
	}*/


	processUSBDevices() {
		var availableDevices = ImportFiles.devicePaths;
		for (var i=0, len=availableDevices.length; i<len; i++) {
			ImportFiles.currentDevice = availableDevices[i];
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

		//Limit the files to be imported, can be used for testing
		if (self.limitFileImportTo > 0) {
			fileListArr = fileListArr.splice(0,self.limitFileImportTo);
		}

		self.filterFileListDuplicates(fileListArr).then(function (filteredFileListArr) {
			var filteredFileList = filteredFileListArr.join('\n');
			var filesNo          = filteredFileListArr.length;

			if (filesNo <= 0) {
				console.error('No files found to import');
				return self.stopExecution();
			}

			self.getImportID(device,filesNo, function proceedWithImport(importID) {

			self.saveFileListToDisk(filteredFileList, device, importID)
				.then(self.prepareSourceDestinationMapping)
				.then(self.readMappingFile)
				.then(self.processMappedPaths);
			});

		});

	}


	filterFileListDuplicates(fileListArr) {
		//return Promise.resolve(fileListArr);

		if (ImportFiles.handleDuplicates !== 'ignore') {
			return Promise.resolve(fileListArr);
		}

		return new Promise(function (resolve, reject) {;
			async.filterLimit(fileListArr, ImportFiles.asyncLimit, function(filePath, callback) {
				if (filePath.length < ImportFiles.currentInstance.settings.importFilter.minPathLength) {
					return callback(null,false);
				}
				ImportFiles.Imgdup.isDuplicate(filePath, function (err, exists) {
					if (exists === false) {
						return callback(null, true);
					} else {
						ImportFiles.currentInstance.importErrors.push({
										filename: filePath, 
										error: "Is duplicate", 
										errorMessage:''});
						return callback(null, false);
					}
				});
			}, function(err, results) {
				unique(results);
				resolve(results);
			});

		}); //Promise
		
	}


	prepareSourceDestinationMapping(_fileListPath) {
		return new Promise(function (resolve, reject) {
			if (ImportFiles.isLocalImport) {
				var ignorepath = ImportFiles.currentInstance.settings.filePath.src;
			} else {
				//USB import
				var ignorepath = ImportFiles.currentDevice;
			}

			var basepath      = '/home/yvesmeili/Sites/zivi/local-photo-station/';
			var filelistpath  = _fileListPath,
				outputfile    = ImportFiles.currentInstance.settings.filePath.logs.fileList + 'import-processed.txt',
				pathseperator = '/',
				tagallfileparts = ImportFiles.taggerFileparts;

			const ls = spawn('php', ['php-filesorter/filesorter.php','--filelistpath='+filelistpath,'--outputfile='+outputfile,'--ignorePath='+ignorepath,'--pathseperator='+pathseperator,'--tagallfileparts='+tagallfileparts]);

			ls.stdout.on('data', (data) => {
				console.log(">> " + data + " <<");
			});

			ls.stderr.on('data', (data) => {
				reject();
				console.log(`stderr: ${data}`);
			});

			ls.on('close', (code) => {
				resolve(outputfile);
				//console.log(`child process exited with code ${code}`);
			});
		});
	}


	readMappingFile(mappingFilePath) {
		var self = this;
		return new Promise(function (resolve, reject) {
			var obj = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
			resolve(obj);
		});
	}


	processMappedPaths(mappedFiles) {
		var self = ImportFiles.currentInstance;

		//show progress bar
		self.fileImportProgressBar = new ProgressBar('  Importing [:bar] :percent :etas', {
													total: mappedFiles.length,
													complete: '=',
													incomplete: ' ',
													width: 60
												});

		//return Promise.all(files.map(this.importFile,this));
		console.log("Amount of files to process: " + mappedFiles.length);
		async.eachLimit(mappedFiles, ImportFiles.asyncLimit, self.importFile, function(err) {
			if (err) {
				console.log('Generic import error: ' + err);
			}
			self.copyComplete(self);
		});

	}


	importFile(fileObject, callback) {
		var self = ImportFiles.currentInstance;
		//return new Promise(function(resolve, reject){

			if (fileObject.filepath) {
				var filePath = fileObject.filepath;
			} else {
				var filePath = fileObject;
			}

			//console.log(fileObject);
			//return Promise.resolve(true);

		
			if (!self.sourceFileIsValid(filePath)) {
				self.importErrors.push({
										filename: filePath, 
										error: "Source file not valid", 
										errorMessage:''});
				//return resolve();
				return callback(null);
			}

			if (fileObject.destination) {
				var fileName = fileObject.destination;//self.createUniqueFileName(filePath);
			} else {
				var fileName = self.createUniqueFileName(filePath);
			}
			
			//SOURCE filepath
			var fileSrc  = filePath;

			//DESTINATION filepath
			if (ImportFiles.runTagger && fileObject.destination) {
				//if run tagger is set and final destination is already known
				var fileDest = self.settings.filePath.media.final + fileName;
			} else {
				var fileDest = self.settings.filePath.media.dest + fileName;
			}
			//self.copyFile(fileSrc,fileDest,resolve,reject);

			//DUPLICATES handling
			if (ImportFiles.handleDuplicates !== 'overwrite') {
				try {
				    fs.accessSync(fileDest, fs.F_OK);
				    // Rename the file
				    var ext = path.extname(fileName);
				    fileDest = path.dirname(fileDest) + "/" + path.basename(fileDest,ext) + '_' + Date.now() + ext;
				} catch (e) {
				    // OK create it
				}
			}

			//create destination if needed
			mkdirp.sync(path.dirname(fileDest));

			//TODO handle duplicate files at destination

			//copy file
			var readStream  = fs.createReadStream(fileSrc),
	    		writeStream = fs.createWriteStream(fileDest, {autoClose: true});

	    	readStream.on('error', function (err) {
	    		self.importErrors.push({
										filename: fileSrc, 
										error: "Can't read file from source", 
										errorMessage:err});
	    		//return reject();
	    		return callback(null);
	    	});
			writeStream.on('error', function (err) {
	    		self.importErrors.push({
										filename: fileSrc, 
										error: "Can't open new file at dest", 
										errorMessage:err});
	    		//return reject();
	    		return callback(null);
	    	});

			writeStream.on('open', function() {
		    	readStream.pipe(writeStream);
		    });

			writeStream.once('finish', function() {
				self.addSuccessImportToArray(fileSrc,fileDest);
				self.fileImportProgressBar.tick();

				//Tag file if is set and keyword is available
				if (ImportFiles.runTagger && fileObject.keywords) {
					
					ImportFiles.tagfile.writeAllTags(fileDest, fileObject.keywords, function (success) {
						if (!success) {
							self.importErrors.push({
									filename: fileDest, 
									error: "Can't tag file", 
									errorMessage:success
								});
						}
						//return resolve();
						return callback(null);
					});
				
				} else {
					//return resolve();
					return callback(null);
				}
			});

		//});

	}


	addSuccessImportToArray(src,dest) {
		ImportFiles.Imgdup.getFileHashFromFile(src)
		.then(function (hash) {
			ImportFiles.currentInstance.importedFiles.push( { 
											  src:  src, 
											  dest: dest,
											  hash: hash
											} );
		})
		.catch(function () {
			ImportFiles.currentInstance.importedFiles.push( { 
											  src:  src, 
											  dest: dest,
											  hash: ''
											} );
		});
	}


	copyComplete(self) {
		
		console.log("DB: Inserting files");

		async.eachLimit(self.importedFiles, ImportFiles.asyncLimit, self.dbSaveFiles, function(err) {
			console.log(err);

			self.dbUpdateImport()
			.then(self.saveErrorLog)
			.then(self.finish);

		});


	}


	dbSaveFiles(file, callback) {
		ImportFiles.db.parallelize(function () {
			var importStatus = ImportFiles.runTagger ? 'tagged' : 'imported';
			ImportFiles.db.run("INSERT INTO imported_files (importID,src,dest,hash,status) VALUES ($importid,$src,$dest,$hash,$status)", {
				$importid: ImportFiles.currentImportID,
				$src: file.src,
				$dest: file.dest,
				$hash: file.hash,
				$status: importStatus
			}, function (err) {
				if (err) {
					console.log("Error occured while trying to insert file");
					ImportFiles.currentInstance.importErrors.push({filename:'',error:"Can't insert file import: " + file.src + " DEST: " + file.dest});
				}
				return callback(null);
			});
		});
	}


	dbUpdateImport() {
		//save end time and import stats
		return new Promise(function(resolve, reject){
			ImportFiles.db.serialize(function () {
				console.log("Updating imports");
				ImportFiles.db.run("UPDATE imports SET end = $end, filelisthash = $hash, filesOut = $files, status = $status WHERE ID = $importid", {
					$importid: ImportFiles.currentImportID,
					$hash: ImportFiles.fileListHash,
					$end: moment().format(),
					$files: ImportFiles.currentInstance.importedFiles.length,
					$status: 'imported'
				}, function (err) {
					if (err) {
						console.log("Error occured while trying to update imports");
						ImportFiles.currentInstance.importErrors.push({filename:'',error:"Can't update database import enddate and filecount"});
					}
					resolve(true);

				});
			});
		});
	}


	saveErrorLog() {
		return new Promise(function (resolve,reject) {

			var logFilePath = ImportFiles.currentInstance.settings.filePath.logs.errors;
			if (logFilePath.length <= 5) {
				return resolve();
			}

			if (ImportFiles.currentInstance.importErrors.length === 0) {
				return resolve();
			}
			
			//if log file path doesn't exist attempt to create it
			try {
				// Exists
			    fs.accessSync(logFilePath, fs.F_OK);
			} catch (e) {
			    // Create it
			    fs.writeFileSync(logFilePath, moment().format() + " Log File created \n", 'utf8');
			}

			var errorTxt = '';

			ImportFiles.currentInstance.importErrors.forEach(function (err) {
				errorTxt += moment().format() + ' ' + err.filename + ' ' + err.error + "\n";
			});

			fs.appendFile(logFilePath, errorTxt, function(err) {
			    if(err) {
			       console.error(err);
			    }
			    return resolve();
			}); 

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


	saveFileListToDisk(fileListTxt, device, importid, callback) {
		var self = this;

		return new Promise(function (resolve, reject) {
			if (fileListTxt.length <= self.settings.importFilter.minPathLength) {
				reject();
				return false;
			}

			var deviceName  = path.basename(device);
			var logFilePath = self.settings.filePath.logs.fileList + 'importtask-' + importid + '-' + deviceName + '-' + moment(ImportFiles.startDate).format("YYYYMMDD_Hmmss") + '.log';

			fs.writeFile(logFilePath, fileListTxt, function(err) {
			    if(err) {
			    	reject();
			        return console.error(err);
			    } else {
			    	resolve(logFilePath);
			    }
			}); 
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

	stopExecution() {
		ImportFiles.currentInstance.saveErrorLog();
		process.exit();
	}


}

module.exports.ImportFiles = ImportFiles;

