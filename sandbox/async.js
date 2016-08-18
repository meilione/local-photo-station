
var async = require("async");
var ExifImage   = require('exif').ExifImage;

console.log('1');

var basePath = '/home/yvesmeili/Sites/zivi/local-photo-station/data/local-data-test/Orangutan Haven/';

async.filter([basePath + 'SAM_2085.JPG',basePath + 'SAM_2108.JPG', basePath + 'SAM_2135.JPG'], function(filePath, callback) {

	try {
	    new ExifImage({ image : filePath }, function (error, exifData) {
	        if (error) {
	            console.log('Error: '+error.message);
	        	callback(null, false);
	        } else {
	            //var hash = md5(exifData);
	        	callback(null, true);
	        }
	    });
	} catch (error) {
		callback(false);
	    console.log('Error: ' + error.message);
	}

}, function(err, results) {
    
	console.log(err);
	console.log(results);

});


console.log('2');