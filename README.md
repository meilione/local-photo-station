TODO

Daemon
- daemon, discover when usb is plugged (same again)
- if import is running for more than 1 hour maybe reset?

- use supervisor program https://www.toptal.com/nodejs/top-10-common-nodejs-developer-mistakes
- mount win share on linux -> install NTFS on windows server
- add keyword Orangutan if it is an orangutan name (phpfilesorter?)

OK - add sound as OK and ERR signals as when runnign script on the server
NOPE- store original file name (parts) in metadata as an option
OK - mount USB drives if they are not mounted (happens mostly on servers)
OK - move everything to live environment
OK - when importing from USB, set ignore path in tagger to the base path of the stick
OK - limit max amount of data processed at any time (process in batch if more than > 1000)
OK - improve structuring where the file is put
OK	- group files that have only dates
OK	- group files that only have orangutan names
OK - keywords adding to file in a more structured way author to author location as location etc
OK - ASYNC duplication problem?
OK - don't start the tagger if already tagged the files
OK - how to deal with duplicate imports?
OK - if can't get date from file name, try getting month and year from exiftool in php-filesorter
OK - php-filesorter send each metadata object with echo to node, in node process each object and append to internal array
OK - integrate tagging of the files with exiftool