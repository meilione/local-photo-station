
var FileImporter = require('./lib/import');
var Tagger = require('./lib/keyword-generator');

var settings = {
	filePath : {
		media : {
			src  : '',
			dest : '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/'
		},
		logs : {
			fileList : '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/',
			errors   : '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.imported-waiting/importerrors.log'
		}
	},
	importFilter : {
		ignoreDevices : ['sda','loop0'],
		minPathLength : 5
	}
}