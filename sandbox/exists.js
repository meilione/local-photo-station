

var ImageDuplicate = require('../lib/image-duplicates.js').ImageDuplicate;
var config          = require('config');
var async       = require('async');


var dbConfig = config.get('global.dbConfig');


var imgdup = new ImageDuplicate(config.get('global.dbConfig'));



var fileListArr = [
'/media/yvesmeili/5574266F20456D34/.Trash-1000/files/P1080692.JPG',
'/media/yvesmeili/5574266F20456D34/January 2012/IMG_1209.JPG',
'/media/yvesmeili/5574266F20456D34/P1080691.JPG',
'',
]
filterFileListDuplicates(fileListArr)
.catch(function (files) {
	console.log('bad');
})
.then(function (files) {
	console.log('fine');
});

function filterFileListDuplicates(fileListArr) {

	return new Promise(function (resolve, reject) {;
		async.filterLimit(fileListArr, 1000, function(filePath, callback) {
			imgdup.isDuplicate(filePath, function (err, exists) {
				if (exists !== false) {
					callback(null, true);
				} else {
					callback(null, false);
				}
			});
		}, function(err, results) {
			console.log(results);
			resolve(results);
		});

	});
	
}

