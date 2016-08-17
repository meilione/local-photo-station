/*
* Tag file
*/
const exec      = require('child_process').exec;

class TagFile {


	constructor() {
		TagFile.maxBufferSizeMB = 64;
	}


	exiftag(file, keywords, callback) {
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


	keywordListToExifList(keywords) {
		var keywordList = ''
		keywords.forEach(function (el) {
			keywordList += ' -keywords+="'+ el +'"';
		});
		return keywordList;
	}

}

module.exports.tagfile = TagFile;