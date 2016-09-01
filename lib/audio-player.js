//audio player
// requires mplayer

var spawn = require('child_process').spawn


class AudioPlayer {


	constructor() {
		this.audioPath       = './audio/';
		this.player          = 'mplayer';
		this.muted           = false;
		this.useVoiceSet     = false;
		this.waitSwitch      = false;
		this.availableSounds = {
				'success' : 'success.wav',
				'error'   : 'error.wav',
				'blipp'   : 'blipblip.wav',
				'gling'   : 'glingg.wav',
				'wait'    : 'wait.wav',
				'progress': 'progress.wav',
		};
	}


	mute(_doit) {
		if (_doit === true || _doit === false) {
			this.muted = _doit;
		}
	}

	useVoices(_doit) {
		if (_doit === true || _doit === false) {
			this.useVoiceSet = _doit;
		}
	}


	play(sound) {
		//TODO check if it is path, then use path
		if (this.availableSounds[sound]) {
			this.spawnAudio(sound);
		}
	}


	error() {
		this.spawnAudio('error');
	}


	success() {
		this.spawnAudio('success');
	}


	wait() {
		var audioSound = this.waitSwitch ? 'progress' : 'wait';
		this.spawnAudio(audioSound);
		this.waitSwitch = !this.waitSwitch;
	}


	spawnAudio(sound) {
		if (this.muted) {
			return false;
		}
		
		var child = spawn(this.player, [this.getFilePath(sound)]);
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


	getFilePath(sound) {
		if (this.useVoiceSet) {
			return this.audioPath + 'voice-' + this.availableSounds[sound];
		} else {
			return this.audioPath + this.availableSounds[sound];
		}
	}


}

module.exports.AudioPlayer = AudioPlayer;

