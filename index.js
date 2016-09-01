
/*
*
* export NODE_ENV=production
*
* Console color coding
* https://coderwall.com/p/yphywg/printing-colorful-text-in-terminal-when-run-node-js-script
*
*/

var FileImporter = require('./lib/import').ImportFiles;
var argv         = require('minimist');
var config       = require('config');
var sqlite3      = require('sqlite3');
var yesno        = require('yesno');
var fs           = require('fs');

var args = {
    'alias' : {
      'i' : 'import',
      's' : 'source',
      'c' : 'conflict',
      't' : 'tag',
      'f' : 'fileparts',
      'm' : 'move',
      'L' : 'limit',
      'D' : 'delete',
      'p' : 'parallelexec',
      'h' : 'help'
    }
}

args = argv(process.argv.slice(2), args);

var runImporter      = args.import;
var runTagger        = args.tag;
var importIsLocal    = args.source;
var conflictHandling = args.conflict;
var fileparts        = args.fileparts;
var parallelexec     = args.parallelexec;

var dbConfig = config.get('global.dbConfig');

//Display help
var noArgumentsSet = !runImporter && !runTagger && !args.help && !args.delete;
if (args.help || noArgumentsSet) {
	console.log('\x1b[1mlocal-photo-station import, tag and organize digital assets\x1b[0m');
	console.log('');
	console.log('Use local-photo-station as follows:');
	console.log("");
	console.log("Example: node index.js -import -tag");
	console.log("");
	console.log("\tImporting media files");
	console.log("\t\t-i, --import\tThis will import files from all plugged in USB drives.");
	console.log("\t\t-L, --limit\tLimit the number of files for import (by filetree).\n\t\t\t\tmainly used for testing purposes.");
	console.log("\t\t-s, --source\tIf a local file path is specified with source this has precedence\n\t\t\t\tover plugged USB devices.");
	console.log("\t\t-c, --conflict\tHow to deal with duplicates during import ignore, overwrite or rename. \n\t\t\t\tIgnore is default and takes longer time to process.");
	console.log("");
	console.log("\tTagging media files");
	console.log("\t\t-t, --tag\tUse to run the tagger. This will add tags based on \n\t\t\t\tfile paths to the images. Has to run with the importer.");
	//console.log("\t\t-f, --fileparts\tIn addition to the generated tags, store each file path part as keyword");
	console.log("");
	console.log("");
	console.log("\tOPTIONS");
	console.log("\t\t-p, --parallelexec\tSets the maximum amount of parallel executions. Default 1000");
	console.log("");
}


//Run importer
if (runImporter) {
	importStart();
}

//Only tagger selected
if (!runImporter && runTagger) {
	console.log('\x1b[1m\x1b[31mYou must use the tagger with the importer!\x1b[0m');
	console.log("");
}


function importStart() {
	console.log("Index.js: Import Started");
	var settings = {'global' : config.get('global'), 'local' : config.get('module.importer') };
	var Importer = new FileImporter(settings, dbConfig, importFinished);
	Importer.activateTagger(runTagger);
	Importer.setTaggerSettings(fileparts);
	Importer.setDuplicateMode(args.conflict);
	Importer.setMaxParallelExecutions(args.parallelexec);
	if (args.limit || config.has('debug.importFileLimit')) {
		var limitFilesTo = args.limit || config.get('debug.importFileLimit');
		if (limitFilesTo > 0) {
			console.log("Limiting to " + limitFilesTo + " files");
			Importer.limitFileImportTo = limitFilesTo;
		}
	}

	if (args.source) {
		var localfilepath = args.source;
		Importer.start('',localfilepath);
	} else {
		Importer.start();
	}
}

function importFinished(device) {
	console.log("Index.js: Import finished");
	finishCLI();
}


/*
* Reset Imports
*/
if (args.delete) {
	askTruncateDB();
}

function askTruncateDB() {
	yesno.ask('\x1b[1m\x1b[31mAre you sure you want to delete the table records from imports and imported_files (yes/no)?\x1b[0m', false, function(ok) {
	    if(!ok) {
	    	console.log("Didn't delete anything");
	    	askDeleteLogs();
	    	return false;
	    }
        truncateDB()
        	.then(askDeleteLogs);
	});
}

function truncateDB() {
	return new Promise(function (resolve,reject) {;
	var db = new sqlite3.Database(dbConfig.file);
	db.serialize(function () {
		db.run("DELETE FROM imports", function (err,rows) {
			if (err) {
				console.error(err);
				return false;
			}
		});
		db.run("DELETE FROM imported_files", function (err,rows) {
			if (err) {
				console.error(err);
				return false;
			} else {
				console.log("Table rows deleted");
			}
		});
		db.run("DELETE FROM sqlite_sequence WHERE name='imports' OR name='imported_files'", function (err,rows) {
			if (err) {
				console.error(err);
				return false;
			} else {
				console.log("Okay, reset sequence");
			}
		});
		db.run("VACUUM", function (err,rows) {
			if (err) {
				console.error(err);
				return false;
			} else {
				console.log("Okay, vacuum'ed");
				db.close();
				resolve(true);
			}
		});
	});
	});
}

function askDeleteLogs() {
	yesno.ask('\x1b[1m\x1b[31mAre you sure you want to delete the log files (yes/no)?\x1b[0m', false, function(ok) {
		if (!ok) {
			console.log("Not deleting any logs.");
			finishCLI();
			return false;
		}
		deleteLogs();
	});
}

function deleteLogs() {
	//TODO get all log files and delete them
	var logDir = config.get('global.filesystem.filePath.logs.fileList');
	var logs = fs.readdirSync(logDir);

	logs.forEach(function (file) {
		fs.unlinkSync(logDir + file);
		console.log('Deleted: ' + logDir + file);
	});

	finishCLI();
}

function finishCLI() {
	process.exit();
}


