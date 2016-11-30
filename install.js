// Download and unzip Sauce-Connect.jar to thirdparty directory.
// means we no longer need to bundle the large binary with this.

var fs = require('fs')
var path = require('path')
var request = require('request')
var unzip = require('unzip')

var SAUCE_CONNECT_URL = 'https://saucelabs.com/downloads/Sauce-Connect-latest.zip'
var jarName = 'Sauce-Connect.jar'
var jarPath = path.join(__dirname, 'thirdparty', jarName)

if (fs.existsSync(jarPath)) {
  console.log("Sauce Connect already downloaded to "+jarPath)
} else {
  console.log("Downloading Sauce-Connect.jar from SauceLabs...")
  request(SAUCE_CONNECT_URL)
  .pipe(unzip.Parse())
  .on('entry', function(entry) {
    if (entry.path === jarName) {
      entry.pipe(fs.createWriteStream(jarPath))
    } else {
      entry.autodrain()
    }
  })
}
