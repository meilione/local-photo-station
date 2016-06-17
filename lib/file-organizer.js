/*
* Copy files to date folder structure
*/

var Organizer = require('organize.js');

class FileOrganizer {
	
	
	constructor(_settings) {
		FileOrganizer.organizer = new Organizer();

		this.settings = _settings;
		this.organizeConfig = {
			from : this.settings.filePath.media.dest,
			types: "mp4,3pg,mov,avi,mpg,mov,mp4,jpg,jpeg,png,gif,cr2",
			to: "[" + this.settings.filePath.media.final + "]/YYYY/MM/DD",
			recursive: true,
			move: true,
			dryrun: false
		}
	}


	start() {
		console.log('Starting the organizer with the following settings: ');
		console.log( this.organizeConfig );
		FileOrganizer.organizer.start(this.organizeConfig);
	}


	finish() {

	}


}

module.exports.fileorganizer = FileOrganizer;

/*
var baseDirectoryDest = '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/';

var settings = {
	filePath : {
		media : {
			src  : '',
			dest : baseDirectoryDest + '.imported-waiting/',
			final : baseDirectoryDest + 'imported/'
		},
		logs : {
			fileList : baseDirectoryDest + '.imported-waiting/',
			errors   : baseDirectoryDest + '.imported-waiting/importerrors.log'
		}
	},
	importFilter : {
		ignoreDevices : ['sda','loop0'],
		minPathLength : 5
	}
}
var organizer = new FileOrganizer(settings);
organizer.start();
*/