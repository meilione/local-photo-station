
/*
* Keyword Generator Class
*/

var sqlite3 = require('sqlite3');
const exec  = require('child_process').exec;
var ProgressBar = require('progress');

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
		this.callback();
	}


	loadImportInfo() {
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

		if (KeywordGenerator.filesToProcess.length < 1) {
			return Promise.reject();
		}

		KeywordGenerator.progressBar = new ProgressBar('  Tagging [:bar] :percent :etas', {
														total: this.addKeywordsFromPath.length,
														complete: '=',
														incomplete: ' ',
														width: 60
													});

		return Promise.all(KeywordGenerator.filesToProcess.map(this.addKeywordsFromPath,this));

	}


	addKeywordsFromPath(fileDuple) {
		var self = this;

		var processPromise = new Promise(function(resolve, reject){
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
				resolve(fileDuple.dest);
				return false;
			}
			if (filePath.length <= 5) {
				return false;
			}

			//TODO maybe link keywords to file in DB
			//DB query

			//add keywords with exiftool
			var keywordList = self.keywordListToExifList(fileKeywords);

			var child = exec('exiftool ' + fileDuple.dest + ' ' + keywordList + ' -overwrite_original', {maxBuffer: 1024 * 1024 * KeywordGenerator.maxBufferSizeMB});
			child.stdout.on('data', function(data) {
			    //console.log('stdout: ' + data);
			});
			child.stderr.on('data', function(data) {
			    //console.log('stdout: ' + data);
			});
			child.on('close', function (code) {
				//resolve item
				KeywordGenerator.processedFiles.push(fileDuple.ID);
				resolve(fileDuple.dest);
			});

		});

		return processPromise.then(function () {
			KeywordGenerator.progressBar.tick(); 
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
