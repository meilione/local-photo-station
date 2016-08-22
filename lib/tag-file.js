/*
* Tag file
*
*	http://search.cpan.org/dist/Image-ExifTool/lib/Image/ExifTool/TagNames.pod
*
*	Exif.Image.Artist 
*
*	Used by windows
*	Exif.Image.XPTitle
*	Exif.Image.XPComment
*	Exif.Image.XPAuthor
*	Exif.Image.XPKeywords
*	Exif.Image.XPSubject
*
*	Exif.Photo.UserComment
*
*	[IPTC]          Keywords                        : media, yvesmeili, PPLH, January, 2006
*	[IPTC]          OriginatingProgram              : yel photo importer
*	[IPTC]          Country-PrimaryLocationCode     : IDN
*	[IPTC]          Country-PrimaryLocationName     : Indonesia
*	[IPTC]          Caption-Abstract                : Inside the class room with the team from PPLH, Orangutan:Klik
*	[IPTC]          Writer-Editor                   : Sarah Fadilla
*	[XMP]           Orangutan                       : Jovi
*	[XMP]           Description                     : Inside the class room with the team from PPLH, Orangutan:Klik
*	[XMP]           Subject                         : media, yvesmeili, PPLH, January, 2006
*	[XMP]           CaptionWriter                   : Sarah Fadilla
*	[XMP]           City                            : Medan
*	[XMP]           Country                         : Indonesia
*	[XMP]           SupplementalCategories          : PPLH
*	[XMP]           CountryCode                     : IDN
*
*/


const exec      = require('child_process').exec;
var sqlite3     = require('sqlite3');

class TagFile {


	constructor(_dbConfig) {
		TagFile.maxBufferSizeMB = 64;

		TagFile.keywordTypesLoaded = false;
		TagFile.keywordTypes = [];

		TagFile.dbConfig = _dbConfig;
		TagFile.db = new sqlite3.Database(TagFile.dbConfig.yelobjects);
		this.loadKeywordTypes()
			.then(this.processKeywordTypes)
			.then(function (res) {
				//console.log(res);
				TagFile.keywordTypes = res;
				TagFile.keywordTypesLoaded = true;
				TagFile.db.close();
			})
			.catch(function (err) {
				TagFile.keywordTypesLoaded = null;
				TagFile.db.close();
			});
	}


	loadKeywordTypes() {
		//console.log(hash);
		return new Promise(function (resolve, reject) {

			TagFile.db.serialize(function () {
			TagFile.db.all("SELECT type, exiftag FROM types", 
				function (err,rows) {
				if (err) {
					console.error(err);
					return reject();
				}
				return resolve( rows );
			});
			});

		});
	}


	processKeywordTypes(dbResults) {
		return new Promise(function (resolve, reject) {
			//split exiftags into array
			for (var idx in dbResults) {
				var row = dbResults[idx];
				row.exiftag = row.exiftag.split(',');
			}
			//add nomatch slot
			var nomatch = { type: 'nomatch' , exiftag: ['=XPKeywords','+keywords','+subject'] };
			dbResults.push(nomatch);
			resolve(dbResults);
		});
	}


	exiftag(file, keywords, callback) {
		var keywords = this.objectToArray(keywords);
		if (keywords.length === 0) {
			callback(true);
		}

		//add keywords with exiftool
		var keywordList = this.keywordListToExifList(keywords);

		var child = exec('exiftool "' + file + '" ' + keywordList + ' -overwrite_original', {maxBuffer: 1024 * 1024 * TagFile.maxBufferSizeMB});

		child.stderr.on('data', function(data) {
		    //console.log('stdout: ' + data);
		    //console.error("File not processed: " + data.toString());
		    //TagFile.filesWithErrors.push({file: file, error: 'Exif write failed: ' + data});
		    callback(false);
		});
		child.on('close', function (code) {
			//TagFile.processedFiles.push(file);
			callback(true);
		});
	}


	writeAllTags(file, keywords, callback) {
		var self = this;

		if (TagFile.keywordTypesLoaded === false) {
			//console.log('Waiting for keyword types');
			setTimeout(function () {
				self.writeAllTags(file,keywords,callback);
			}, 200);
			return;
		}

		//console.log('Tagging');
		//console.log(keywords);

		var keywordList = this.buildExifTaggingString(keywords);

		//console.log('Processed');
		//console.log(keywordList);

		var child = exec('exiftool "' + file + '" ' + keywordList + ' -overwrite_original', {maxBuffer: 1024 * 1024 * TagFile.maxBufferSizeMB});

		child.stderr.on('data', function(data) {
		    //console.log('stdout: ' + data);
		    //console.error("File not processed: " + data.toString());
		    callback(false);
		});
		child.on('close', function (code) {
			//console.log(code);
			callback(true);
		});

	}


	keywordListToExifList(keywords) {
		var keywordList = ''
		keywords.forEach(function (el) {
			keywordList += ' -keywords+="'+ el +'"';
		});
		return keywordList;
	}


	buildExifTaggingString(keywords) {
		var str = '';

		for (var idx in TagFile.keywordTypes) {
			var type = TagFile.keywordTypes[idx].type;
			var exiftags = TagFile.keywordTypes[idx].exiftag;
			//console.log('Checking type: ' + type );
			if (keywords[type]) {
				//console.log(keywords[type]);
				str += this.buildExifTagValue(exiftags,keywords[type]);
			} else {
				//console.log('no keywords with this type');
			}
		}

		return str;
	}


	buildExifTagValue(exiftags,values) {
		var str = '';

		exiftags.forEach(function (tag) {
			var mode = tag.substr(0,1);
			var tag  = tag.substr(1,50);
			mode = mode === '=' ? '' : mode;
			values.forEach(function (val) {
				str += ' -' + tag + mode + '="' + val + '"';
			});
		});

		return str;
	}


	objectToArray(obj) {
		var arr = [];
		
		if (typeof obj !== "object") {
			return arr;
		}

		for (var index in obj) {
			if (Array.isArray(obj[index])) {
				arr = arr.concat(obj[index]);
			} else {
				arr.push(obj[index]);
			}
		}
		return arr;
	}

}

module.exports.tagfile = TagFile;