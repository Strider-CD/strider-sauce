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

var connectorProcs = []

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
function sauceConfigured(config) {
  var sauceAccessKey = config.access_key
  var sauceUsername = config.username

  if (!sauceAccessKey
    || !sauceUsername) {
    return false
  }

  return true
}

// This will shut down the tunnel in a nice way
function cleanup(ctx, cb) {
  cleanupRun = true
  var msg = "Shutting down Sauce Connector"
  console.log(msg)
  ctx.comment(msg)
  connectorProcs.forEach(function(connectorProc){
    connectorProc.kill("SIGINT")
    // Give Sauce Connector 5 seconds to gracefully stop before sending SIGKILL
    setTimeout(function() {
      if (connectorProc) connectorProc.kill("SIGKILL")
      fs.unlink(PIDFILE, function() {})
      msg = "Sauce Connector successfully shut down"
      console.log(msg)
      ctx.comment(msg)

      return cb(0)
    }, 5000)
  });
}


function prepare(config, ctx, cb) {

  var sauceAccessKey = config.access_key
  var sauceUsername = config.username
  var sauceBrowsers = config.browsers

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
    ctx.comment(msg)
    console.log(msg)
  }


  // Start the Sauce Connector. Returns childProcess object.
  function startConnector(username, apiKey, proxy, num, exitCb) {
    var jarPath = path.join(__dirname, "thirdparty", "Sauce-Connect.jar")
    var jcmd = "java"
    var jargs = ["-Xmx64m", "-jar", jarPath, username, apiKey]
    var screencmd = "java -Xmx64m -jar " + jarPath + " [USERNAME] [API KEY]"
    if(proxy){
      jargs.push("-i", proxy.name);
      jargs.push("-p", proxy.value);
      jargs.push("-P", "445"+num);
      screencmd += " -i " + proxy.name + " -p " + proxy.value + " -P 445" + num;
    }
    if(!num){
      num = 0;
    }
    
    ctx.comment("Starting Sauce Connector")
    var opts = {
      cwd: ctx.workingDir,
      cmd: {
        command: jcmd,
        args: jargs,
        screen: screencmd
      }
    }
    connectorProcs[num] = ctx.cmd(opts, exitCb)

    if (num == config.proxies.length - 1 || config.proxies.length == 0){
      // Wait until connector outputs "You may start your tests"
      // before returning
      connectorProcs[num].stdout.on('data', function(data) {
        console.log(">>", data);
        if (/Connected! You may start your tests./.exec(data) !== null) {
            console.log(">> STRIDER-SAUCE :: TUNNEL READY")
            return cb(null, true)
        }
      })
    }
  }
  console.log("Starting sauce connector")

  if (config.proxies.length > 0){
    for (var i=0; i<config.proxies.length; i++) {
      startConnector(sauceUsername, sauceAccessKey, config.proxies[i], i,
      function(exitCode) {
      console.log("Sauce Connector exited with code: %d", exitCode)
      // If the connector exited before the cleanup phase has run, it failed to start
      if (!cleanupRun) {
        log("Error starting Sauce Connector - failing test")
        cleanupRun = true
        fs.unlink(PIDFILE, function() {})
        return cb(1)
      }
    })
    }
  } else {
    startConnector(sauceUsername, sauceAccessKey, null, null,
      function(exitCode) {
      console.log("Sauce Connector exited with code: %d", exitCode)
      // If the connector exited before the cleanup phase has run, it failed to start
      if (!cleanupRun) {
        log("Error starting Sauce Connector - failing test")
        cleanupRun = true
        fs.unlink(PIDFILE, function() {})
        return cb(1)
      }
    })
  }


}


module.exports = {
  init: function (config, job, context, done) {
    done(null, {

      env: {
             'BROWSERS': JSON.stringify(config.browsers)
           , 'SAUCE_USERNAME' : config.username
           , 'SAUCE_ACCESS_KEY' : config.access_key
           , 'PROXIES': JSON.stringify(config.proxies)
           , 'WEBDRIVER_REMOTE' : JSON.stringify({hostname: "ondemand.saucelabs.com", port: 80, username: config.username, accessKey: config.accessKey})
           },

      prepare: function(ctx, done) {
        if (sauceConfigured(config)) {
          console.log("sauce configured")
        }
        prepare(config, ctx, done)
      },
      cleanup: cleanup
    })
  },
}
