//list usb devices
var config      = require('config');
var blockutils  = require('linux-blockutils');
const exec      = require('child_process').exec;
var async       = require('async');



class USBHandling {


	constructor() {
		this.ignoreDevices = [];
		this.devicePaths = [];
		this.baseMountPath = '/media/';

		USBHandling.currentInstance = this;
	}


	setIgnoredDevices(_devices) {
		if (!_devices) {
			return;
		}
		this.ignoreDevices = _devices;
	}


	getUSBDevices() {
		console.log('Getting USB Devices');
		return this.getPluggedUSBSticks();
	}


	getPluggedUSBSticks() {
		return new Promise(function (resolve, reject) {

			var ignoredDevices = USBHandling.currentInstance.ignoreDevices.join('|');

			blockutils.getBlockInfo({"ignoredev":"^("+ ignoredDevices +")"}, function (err,json){
				if (err) {
					reject("Error: " + err);
					return false;
				}

				if (json.length === 0) {
					reject('No devices found');
					return false;
				}

				async.each(json,USBHandling.currentInstance.getUSBMountPath,function (err) {
					if (err) {
						console.log('Error occured while trying to map and mount usb sticks');
					}
					resolve(USBHandling.currentInstance.devicePaths);
				});

			});

		});
	}


	getUSBMountPath(device, callback) {
		if (device.MOUNTPOINT === '' && device.PARTITIONS) {
			async.each(device.PARTITIONS, function (part, done) {
				if (part.MOUNTPOINT !== '') {
					USBHandling.currentInstance.devicePaths.push(part.MOUNTPOINT);
					done();
				} else {
					USBHandling.currentInstance.mountUSBStick(part).then(function (mountedPath) {
						USBHandling.currentInstance.devicePaths.push(mountedPath);
						done();
					});
				}
			}, function (err) {
				callback();
			});
		} else if (device.MOUNTPOINT !== '') {
			USBHandling.currentInstance.devicePaths.push(device.MOUNTPOINT);
			return callback();
		} else {
			USBHandling.currentInstance.mountUSBStick(device).then(function (mountedPath) {
				USBHandling.currentInstance.devicePaths.push(mountedPath);
				callback();
			});
		}
	}


	mountUSBStick(device) {
		if (device.KNAME === '') {
			return new Promise.resolve();
		}

		console.log('Mounting Device: ' + device.KNAME);
		console.log(device);

		return new Promise(function (resolve,reject) {

			exec("pmount " + device.KNAME, (error,stdout,stderr) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return reject();
				}

				console.log(stdout);
				return resolve(USBHandling.currentInstance.baseMountPath + device.KNAME);
			});

		});


	}


	unmountUSBStick(device) {
		return new Promise(function (resolve,reject) {

			exec("pumount " + device, (error,stdout,stderr) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return reject(device);
				}

				console.log(stdout);
				return resolve(device);
			});

		});
	}


}

module.exports.USBHandling = USBHandling;



/*

//USAGE / TESTING

var usb = new USBHandling();
usb.setIgnoredDevices(['sda','loop']);
usb.getUSBDevices().then(function (res) {

	console.log('done');
	console.log(res);	


	console.log('unmount again for testing purposes');
	for (var idx in res) {
		var device = res[idx];
		usb.unmountUSBStick(device)
		.then(function (dev) {
			console.log('Successfully unmounted ' + dev);
		})
		.catch(function (dev) {
			console.log('Cannot unmount ' + dev);
		});
	}
	

});

*/