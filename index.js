
var FileImporter = require('./lib/import').ImportFiles;
var Tagger = require('./lib/keyword-generator');
var EventEmitter = require('events').EventEmitter;

var test = new FileImporter();

console.log(test);