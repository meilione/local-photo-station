

var ExifTag     = require('../lib/tag-file.js').tagfile;
var config          = require('config');

var dbConfig = config.get('global.dbConfig');
var TagFile = new ExifTag(dbConfig);

var bild = '/home/yvesmeili/Sites/zivi/local-photo-station/sandbox/img_test.jpg';


var keywords = {
	"keywords": {
        "nomatch": [
            "media",
            "yvesmeili"
        ],
        "Month": [
            "January"
        ],
        "Year": [
            "2012"
        ],
        "Orangutan": [
        	"Pibi"
        ],
        "Location": [
        	"PPLH Seloliman",
        	"PPLH"
        ],
        "Person": [
        	"Ian Singleton"
        ],
        "Organisation": [
        	"YEL"
        ],
        "Event": [
        	"Confiscation",
        	"Staff in action"
        ],
        "Medium-Type": [
        	"Report"
        ],
        "Animal": [
        	"Orangutan"
        ]
    }
};

keywords = keywords.keywords;


TagFile.writeAllTags(bild,keywords, function (res) {
	console.log('done' + res);
});