/*
* Sorting files to folders
*/

var fs          = require('fs');
const readline  = require('readline');
const stream    = require('stream');


class YELSortingMedia {


	constructor() {
		/*
		* Txt file with all the file paths available to move to new folder structure
		*/
		YELSortingMedia.fileListPath = '';
		YELSortingMedia.stringSettings = {
			ignorePrefix : 'S:\\shared_files_internal_network_(save_here)\\_Internal_Files\\Multimedia\\Digital Asset Management\\Imported unsorted\\'
		};
	}


	setfilelist(_path) {
		YELSortingMedia.fileListPath = _path;
	}


	start() {
		console.log('Start');
		this.loadFileList();
	}


	loadFileList() {

		const rl = readline.createInterface({
		  input:  fs.createReadStream(YELSortingMedia.fileListPath, {}),
		  output: process.stdout
		});

		rl.on('line', (input) => {
		  //var inputProcessed = input.replace(YELSortingMedia.stringSettings.ignorePrefix,'');
		  console.log('# ' + input + ' #');
		});
	}


	processFileList() {

	}


	processFilePath() {

	}


}


MediaSorter = new YELSortingMedia();

MediaSorter.setfilelist('/home/yvesmeili/Sites/zivi/local-photo-station/data/dam-testfilelist-20160701.txt');

MediaSorter.start();
