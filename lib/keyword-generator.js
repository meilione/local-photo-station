
/*
* Keyword Generator Class
*/

var sqlite3     = require('sqlite3');
const exec      = require('child_process').exec;
var ProgressBar = require('progress');
var async       = require('async');

class KeywordGenerator {


	constructor(_settings, _dbConfig, _callback) {

		/*
		* Stores all file paths
		*/
		KeywordGenerator.files;
		KeywordGenerator.dbConfig = '';
		KeywordGenerator.db;

		/*
		* Stopwords
		*/
		//KeywordGenerator.stopwords_file_path = 'stopwords.txt';
		KeywordGenerator.stopwords = [];

		/*
		* Container for the collected keywords
		*/
		KeywordGenerator.keywordList = [];
		KeywordGenerator.filesToProcess = [];
		KeywordGenerator.processedFiles = [];
		KeywordGenerator.filesWithErrors = [];
		KeywordGenerator.currentImportInfo = {};
		KeywordGenerator.maxBufferSizeMB = 64;

		KeywordGenerator.progressBar;

		//TODO log errors to array and then to file

		/*
		* Settings for matching the keywords
		*/
		var settings = {};
		this.settings = Object.assign(settings,_settings);

		KeywordGenerator.path_prefix = '';

		KeywordGenerator.dbConfig = _dbConfig;

		this.pathPrefix = '';

		if (_callback) {
			this.callback = _callback;
		}
	}


	start() {
		var self = this;

		KeywordGenerator.db = new sqlite3.Database(KeywordGenerator.dbConfig.file);

		this.loadImportInfo()
			.then(this.loadStopWords)
			.then(this.loadKeywordList)
			.then(this.getFilesToProcess)
			.then(this.processFilePaths.bind(self))
			.then(this.setFileImportStatus.bind(self))
			.then(this.finish.bind(self));
	}


	finish() {
		if (KeywordGenerator.filesWithErrors.length > 0) {
			console.log("Following errors occurred during tagging:");
			console.log(KeywordGenerator.filesWithErrors);
		}
		this.callback();
	}


	loadImportInfo() {
		var self = this;
		return new Promise(function (resolve, reject) {

			KeywordGenerator.db.serialize(function () {
			KeywordGenerator.db.all("SELECT * FROM imports WHERE status = $status LIMIT 0,1", 
				{ 
					$status: 'imported' 
				},
				function (err,rows) {
				if (err) {
					console.error(err);
					reject();
					return false;
				}

				if (!rows[0]) {
					console.error('No imports to process');
					self.finish();
					reject();
					return false;
				}

				KeywordGenerator.currentImportInfo = rows[0];
				resolve( KeywordGenerator.currentImportInfo );

			});
			});

		});
	}


	loadStopWords() {
		return new Promise(function (resolve, reject) {

			KeywordGenerator.db.serialize(function () {
			KeywordGenerator.db.all("SELECT stopword FROM stopwords", function (err,rows) {
				if (err) {
					console.error(err);
					reject();
					return false;
				}

				KeywordGenerator.stopwords = rows.map(function(a) {return a.stopword;});
				resolve( KeywordGenerator.stopwords );

			});
			});

		});
	}


	loadKeywordList() {
		return new Promise(function (resolve, reject) {

			KeywordGenerator.db.serialize(function () {
			KeywordGenerator.db.all("SELECT keyword FROM keywords", function (err,rows) {
				if (err) {
					console.error(err);
					reject();
					return false;
				}

				KeywordGenerator.keywordList = rows.map(function(a) {return a.keywords;});
				resolve( KeywordGenerator.keywordList );

			});
			});

		});
	}


	getFilesToProcess() {
		return new Promise(function (resolve, reject) {

			KeywordGenerator.db.serialize(function () {
			KeywordGenerator.db.all("SELECT * FROM imported_files WHERE importID = $id", 
				{
					$id : KeywordGenerator.currentImportInfo.ID
				},
				function (err,rows) {
				if (err) {
					console.error(err);
					reject();
					return false;
				}

				KeywordGenerator.filesToProcess = rows;//rows.map(function(a) {return a.dest;});
				resolve( KeywordGenerator.filesToProcess );

			});
			});

		});
	}


	processFilePaths() {
		var self = this;

		if (KeywordGenerator.filesToProcess.length < 1) {
			return Promise.reject();
		}

		KeywordGenerator.progressBar = new ProgressBar('  Tagging [:bar] :percent :etas', {
														total: KeywordGenerator.filesToProcess.length,
														complete: '=',
														incomplete: ' ',
														width: 60
													});

		//return Promise.all(KeywordGenerator.filesToProcess.map(this.addKeywordsFromPath,this));

		//TODO: implement timeout, if the action doesn't complete all steps it will just hang

		return new Promise(function (resolve,reject) {
			async.eachLimit(KeywordGenerator.filesToProcess, 20, self.addKeywordsFromPath.bind(self), function (err) {
				if (err) {
					console.error("Error occured while keywording: " + err);
				}
				resolve();
			});
		});

	}


	addKeywordsFromPath(fileDuple, resolve) {
		var self = this;
		var filePath = fileDuple.src;

		filePath  = filePath.replace(self.pathPrefix,'');
		var pathParts = filePath.split("/");
		var fileKeywords = [];
		pathParts.forEach(function (part) {
			part = self.cleanString(part);
			if (self.isValidKeyword(part)) {
				fileKeywords.push(part);
				if (KeywordGenerator.keywordList.indexOf(part) === -1) {
					KeywordGenerator.keywordList.push(part);
				}
			}

		});

		if (fileKeywords.length <= 0) {
			KeywordGenerator.processedFiles.push(fileDuple.ID);
			KeywordGenerator.filesWithErrors.push({file: fileDuple, error: 'No keywords possible'});
			console.error("No keywords possible");
			resolve();
			return false;
		}
		if (filePath.length <= 5) {
			resolve();
			return false;
		}

		//TODO maybe link keywords to file in DB
		//DB query

		//add keywords with exiftool
		var keywordList = self.keywordListToExifList(fileKeywords);

		var child = exec('exiftool ' + fileDuple.dest + ' ' + keywordList + ' -overwrite_original', {maxBuffer: 1024 * 1024 * KeywordGenerator.maxBufferSizeMB});
		child.stdout.on('data', function(data) {
		    //console.log('stdout: ' + data);
		    //console.log("Processed: " + fileDuple.ID);
		});
		child.stderr.on('data', function(data) {
		    //console.log('stdout: ' + data);
		    console.error("File not processed: " + data.toString());
		    KeywordGenerator.filesWithErrors.push({file: fileDuple, error: 'Exif write failed: ' + data});
		});
		child.on('close', function (code) {
			//resolve item
			//console.log('Tagged file: ' + fileDuple.ID);
			//console.log("Closed: " + fileDuple.ID);
			KeywordGenerator.processedFiles.push(fileDuple.ID);
			KeywordGenerator.progressBar.tick();
			resolve();
		});


	}


	cleanString(item) {
		item = item.toLowerCase();
		KeywordGenerator.stopwords.forEach(function (stopword) {
			item = item.replace(stopword,' ');
		});
		item = item.replace(/\d+/g,'');
		//item = item.replace(/\s+/g,'');
		item = item.trim();
		return item;
	}


	isValidKeyword(item) {
		if (item.length <= 1) {
			return false;
		}

		return true;
	}


	keywordListToExifList(keywords) {
		var keywordList = ''
		keywords.forEach(function (el) {
			keywordList += ' -keywords+="'+ el +'"';
		});
		return keywordList;
	}


	setFileImportStatus() {
		return new Promise(function (resolve, reject) {

			KeywordGenerator.db.parallelize(function () {
				var processedFilesIDs = KeywordGenerator.processedFiles.join(',');
				KeywordGenerator.db.run("UPDATE imported_files SET status = $status WHERE ID IN("+ processedFilesIDs +")", {
					$status: 'tagged'
				}, function (err) {
					if (err) {
						console.log("Error occured while trying to update imports");
						reject();
					}
					resolve();
				});

				KeywordGenerator.db.run("UPDATE imports SET status = $status WHERE ID = $id", {
					$id : KeywordGenerator.currentImportInfo.ID,
					$status: 'tagged'
				}, function (err) {
					if (err) {
						console.log("Error occured while trying to update imports");
						reject();
					}
				});

			});

		});
	}


}

module.exports.keywordgenerator = KeywordGenerator;
