//image duplicate identifier

var md5         = require('js-md5');
var sqlite3     = require('sqlite3');
var ExifImage   = require('exif').ExifImage;
var async       = require('async');


class ImageDuplicate {


	constructor(_dbConfig) {
		ImageDuplicate.dbConfig = _dbConfig;
		ImageDuplicate.db = new sqlite3.Database(ImageDuplicate.dbConfig.file);
	}


	isDuplicate(filePath, callback) {
		if (filePath === '') {
			return callback('No file path given',false);
		}

		this.getFileHashFromFile(filePath)
		.catch(function (err) {
			return callback('Could not get file Hash',false);
		})
		.then(this.fileHashExists)
		.catch(function (err) {
			return callback('Could not verify existence',false);
		})
		.then(function (exists) {
			return callback(null, exists);
		})
		.catch(function (err) {
			return callback('Image Check Error',false);
		});
	}


	fileHashExists(hash) {
		//console.log(hash);
		return new Promise(function (resolve, reject) {

			ImageDuplicate.db.serialize(function () {
			ImageDuplicate.db.all("SELECT * FROM imported_files WHERE hash = $hash", 
				{
					$hash : hash
				},
				function (err,rows) {
				if (err) {
					console.error(err);
					return reject();
				}

				var exists = rows.length > 0 ? true : false;
				return resolve( exists );
			});
			});

		});
	}


	getFileHashFromFile(filePath) {
		//console.log(filePath);
		return new Promise(function (resolve,reject) {
			try {
			    new ExifImage({ image : filePath }, function (error, exifData) {
			        if (error) {
			            //console.log('Error: '+error.message);
			            return reject(error.message);
			        } else {
			            var hash = md5(JSON.stringify(exifData));
			            return resolve(hash);
			        }
			    });
			} catch (error) {
			    //console.log('Error: ' + );
			    return reject(error.message);
			}
		});
	}


}

module.exports.ImageDuplicate = ImageDuplicate;