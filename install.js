// Download and unzip Sauce-Connect.jar to thirdparty directory.
// means we no longer need to bundle the large binary with this.

var fs = require('fs')
var path = require('path')
var request = require('request')
var unzip = require('unzip')

var SAUCE_CONNECT_URL = 'http://saucelabs.com/downloads/Sauce-Connect-latest.zip'

console.log("Downloading Sauce-Connect.jar from SauceLabs...")
request(SAUCE_CONNECT_URL)
  .pipe(unzip.Parse())
  .on('entry', function(entry) {
    if (entry.path === 'Sauce-Connect.jar') {
      entry.pipe(fs.createWriteStream(path.join(__dirname, 'thirdparty', entry.path)))
    } else {
      entry.autodrain()
    }
  })
