//audio player
// requires mplayer

var spawn = require('child_process').spawn


class AudioPlayer {


	constructor() {
		this.audioPath = './audio/';
		this.player = 'mplayer';
		this.muted = false;
		this.availableSounds = {
				'success' : this.audioPath + 'success.wav',
				'error'   : this.audioPath + 'error.wav',
				'blipp'   : this.audioPath + 'blipblip.wav',
				'gling'   : this.audioPath + 'glingg.wav',
		};
	}


	mute(_doit) {
		if (_doit === true || _doit === false) {
			this.muted = _doit;
		}
	}


	play(sound) {
		//TODO check if it is path, then use path
		if (this.availableSounds[sound]) {
			this.spawnAudio(this.availableSounds[sound]);
		}
	}


	error() {
		this.spawnAudio(this.availableSounds.error);
	}


	success() {
		this.spawnAudio(this.availableSounds.success);
	}


	spawnAudio(audioFile) {
		if (this.muted) {
			return false;
		}
		
		var child = spawn(this.player, [audioFile]);
		child.on('exit', function (code, signal) {
			//errors or success is not crucial, therefore no error or success handling
			/*if(code == null || signal != null || code == 1) {
				//console.log('couldnt play, had an error ' + '[code: '+ code + '] ' + '[signal: ' + signal + ']');
			} else if(code == 127){
				//play.playerList.shift();
				//play.sound(audioFile, callback);
			} else if (code == 2) {
				//console.log(audioFile + '=>' + 'could not be read by your player.')
			} else{
				//console.log( 'completed' + '=>' + audioFile);
			}*/
		});
	}


}

module.exports.AudioPlayer = AudioPlayer;

