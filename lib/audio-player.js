//audio player
// requires mplayer

var spawn = require('child_process').spawn


class AudioPlayer {
	

	constructor() {
		this.audioPath = './audio/';
		this.player = 'mplayer';
		this.availableSounds = {
				'success' : this.audioPath + 'success.wav',
				'error'   : this.audioPath + 'error.wav'
		};
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
		var child = spawn(this.player, [audioFile]);
		child.stderr.setEncoding('ascii');
		child.on('exit', function (code, signal) {
			if(code == null || signal != null || code === 1) {
				console.log('couldnt play, had an error ' + '[code: '+ code + '] ' + '[signal: ' + signal + ']');
			} else if(code == 127){
				//play.playerList.shift();
				//play.sound(audioFile, callback);
			} else if (code == 2) {
				console.log(audioFile.cyan + '=>'.yellow + 'could not be read by your player.'.red)
			} else{
				console.log( 'completed'.green + '=>'.yellow + audioFile.magenta);
			}
		});
	}


}

module.exports.AudioPlayer = AudioPlayer;

