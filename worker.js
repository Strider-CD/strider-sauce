//
// Strider Worker extension for Sauce Labs tests
//

var check = require('httpcheck')
var fs = require('fs')
var path = require('path')
var request = require('request')
var wd = require('wd')

// Port on which the application-under-test webserver should bind to on localhost.
// Sauce Connector will tunnel from this to Sauce Cloud for Selenium tests
var HTTP_PORT
//
// Path to SauceLabs Connector PID file
var PIDFILE = path.join(__dirname, "tunnel.pid")

// SauceLabs test timeout in ms
// Permits self-healing in worst-case hang
var SAUCE_TEST_TIMEOUT = 1000 * 60 * 45 // 45 minutes

var connectorProc

var cleanupRun = false

// Read & parse a JSON file
function getJson(filename, cb) {
  fs.readFile(filename, function(err, data) {
    if (err) return cb(err, null)
    try {
      var json = JSON.parse(data)
      cb(null, json)
    } catch(e) {
      cb(e, null)
    }
  })
}

// Is Sauce configured for this context?
function sauceConfigured(ctx) {
  var sauceAccessKey = ctx.jobData.repo_config.sauce_access_key
  var sauceUsername = ctx.jobData.repo_config.sauce_username

  if (sauceAccessKey === undefined
    || sauceUsername === undefined) {
    return false
  }

  return true
}

// This will shut down the tunnel in a nice way
function cleanup(ctx, cb) {
  console.log("sauce")
  if (!sauceConfigured(ctx)) {
    return cb(0)
  }
  cleanupRun = true
  var msg = "Shutting down Sauce Connector"
  console.log(msg)
  ctx.striderMessage(msg)
  if (connectorProc) connectorProc.kill("SIGINT")
  // Give Sauce Connector 5 seconds to gracefully stop before sending SIGKILL
  setTimeout(function() {
    if (connectorProc) connectorProc.kill("SIGKILL")
    fs.unlink(PIDFILE, function() {})
    msg = "Sauce Connector successfully shut down"
    console.log(msg)
    ctx.striderMessage(msg)

    return cb(0)
  }, 5000)
}


function test(ctx, cb) {

  console.log("sauce")
  if (!sauceConfigured(ctx)) {
    return cb()
  }

  var sauceAccessKey = ctx.jobData.repo_config.sauce_access_key
  var sauceUsername = ctx.jobData.repo_config.sauce_username
  var sauceBrowsers = ctx.jobData.repo_config.sauce_browsers

  if (sauceBrowsers === undefined || sauceBrowsers.length === 0) {
    // Default to latest chrome on Windows Vista
    sauceBrowsers = [
      {
        browserName:"chrome",
        version:"",
        platform:"Windows 2008"
      }
    ]
  }

  function log(msg) {
    ctx.striderMessage(msg)
    console.log(msg)
  }

  HTTP_PORT = ctx.browsertestPort || 8031

  ctx.striderMessage("Waiting for webserver to come up on localhost:" + HTTP_PORT)

  check({url:"http://localhost:"+HTTP_PORT+"/", log:log}, function(err) {
    if (err) {
      clearInterval(intervalId)
      return cb(1)
    }
    serverUp()
  })

  // Start the Sauce Connector. Returns childProcess object.
  function startConnector(username, apiKey, exitCb) {
    var jarPath = path.join(__dirname, "thirdparty", "Sauce-Connect.jar")
    var jsh = ctx.shellWrap("exec java -Xmx64m -jar " + jarPath + " " + username + " " + apiKey)
    
    var done = false
    ctx.striderMessage("Starting Sauce Connector")
    var connectorProc = ctx.forkProc(ctx.workingDir, jsh.cmd, jsh.args, exitCb)
    // Wait until connector outputs "You may start your tests"
    // before executing Sauce tests
    connectorProc.stdout.on('data', function(data) {
      if (/Connected! You may start your tests./.exec(data) !== null) {
        var sauceDoneCount = 0
        var finaleStatusCode = 0
        sauceBrowsers.forEach(function(o) {
        
        
        })
        return cb(0)
      }
    })
  }
  // Server is up, start Sauce Connector
  function serverUp() {
    console.log("Starting sauce connector")
    startConnector(sauceUsername, sauceAccessKey,
      function(exitCode) {
      console.log("Sauce Connector exited with code: %d", exitCode)
      // If the connector exited before the cleanup phase has run, it failed to start
      if (!cleanupRun) {
        log("Error starting BrowserStack Connector - failing test")
        cleanupRun = true
        fs.unlink(PIDFILE, function() {})
        return cb(1)
      }
    })
  }
}


module.exports = function(ctx, cb) {

  ctx.addBuildHook({
    cleanup:cleanup,
    test:test
  })

  console.log("strider-sauce worker extension loaded")
  cb(null, null)
}
