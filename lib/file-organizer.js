/*
* Copy files to date folder structure
*/

var Organizer = require('organize.js');

class FileOrganizer {
	
	
	constructor(_settings, _callback) {
		FileOrganizer.organizer = new Organizer();

		FileOrganizer.callback = _callback;

		var callback = function () {};
		if (_callback) {
			this.callback = _callback;
		}

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


	finish(job) {
		FileOrganizer.callback();
	}


}

module.exports.fileorganizer = FileOrganizer;
