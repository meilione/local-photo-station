
var FileImporter = require('./lib/import').ImportFiles;
var Tagger       = require('./lib/keyword-generator').keywordgenerator;
var Organizer    = require('./lib/file-organizer').fileorganizer;

var EventEmitter = require('events').EventEmitter;
var argv         = require('minimist');
var config       = require('config');
var sqlite3      = require('sqlite3');

var args = {
    'alias' : {
      'i' : 'import',
      't' : 'tag',
      'm' : 'move',
      'L' : 'limit',
      'RM': 'reset'
    }
}

args = argv(process.argv.slice(2), args);

var runImporter  = args.import;
var runTagger    = args.tag;
var runOrganizer = args.move;

var dbConfig = config.get('global.dbConfig');

//Run importer
if (runImporter) {
	importStart();
}

//Run tagger
if (runTagger && !runImporter) {
	taggerStart();
}

//Run organizer
if (runOrganizer && !runImporter && !runTagger) {
	organizerStart();
}


function importStart() {
	var settings = config.get('global.filesystem');
	var Importer = new FileImporter(settings, dbConfig, importFinished);
	if (args.limit) {
		var limitFilesTo = args.limit || config.get('debug.importFileLimit');
		if (limitFilesTo > 0) {
			Importer.limitFileImportTo = limitFilesTo;
		}
	}
	Importer.start();
}

function importFinished() {
	console.log("Index.js: Import finished");
	if (runTagger) {
		taggerStart();
	}
}

function taggerStart() {
	var settings = Object.assign( config.get('global.filesystem'), config.get('module.tagger') );
	var tagger = new Tagger(settings, dbConfig, taggerFinished);
	tagger.start();
}

function taggerFinished() {
	console.log("Index.js: Tagger finished");
	if (runOrganizer) {
		organizerStart();
	}
}

function organizerStart() {
	var settings = Object.assign( config.get('global.filesystem'), config.get('module.tagger') );
	var organizer = new Organizer(settings, organizerFinished);
	organizer.start();
}

function organizerFinished() {
	console.log("Index.js: Organizer finished");
}



/*
* Reset Imports
*/
/*if (args.reset) {
	//TODO ask user for confirmation
	var db = new sqlite3.Database(dbConfig.file);
	ImportFiles.db.serialize(function () {
		ImportFiles.db.all("", 
			{

			},
			function (err,rows) {
			if (err) {
				console.error(err);
				return false;
			}


		});
	});
}
*/

