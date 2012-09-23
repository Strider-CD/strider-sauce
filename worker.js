var fs = require('fs')
var path = require('path')
var request = require('request')

// # of tries for application-under-test webserver to start up on specified port
// We test once per second
var RETRIES = 10

// Port on which the application-under-test webserver should bind to on localhost.
// Sauce Connector will tunnel from this to Sauce Cloud for Selenium tests
var PORT = 8031

// Custom prepare function - runs `npm install`
function prepare(ctx, cb) {
  console.log("SAUCE prepare")
  var tsh = ctx.shellWrap("npm install")
  ctx.forkProc(ctx.workingDir, tsh.cmd, tsh.args, function(exitCode) {
    if (exitCode === 0) {
      ctx.striderMessage("npm install success")
    }
    cb(exitCode)
  })
}

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

// `npm install` has succeeded at this point.
// We run `npm test` and assuming that has passed,
// then we start the Sauce test process.
// If `npm test` fails, we don't bother with the overhead of running the Sauce tests.
function test(ctx, cb) {
  console.log("SAUCE test")
  var startPhaseDone = false
  var tsh = ctx.shellWrap("npm test")
  // Run 
  ctx.forkProc(ctx.workingDir, tsh.cmd, tsh.args, function(exitCode) {
    if (exitCode !== 0) {
      return cb(exitCode)
    } else {
      ctx.striderMessage("npm test success - trying Sauce tests...")
      // Parse package.json so we can run the start script directly.
      // This is important because `npm start` will fork a subprocess a la shell
      // which means we cannot track the PID and shut it down later.
      getJson(path.join(ctx.workingDir, "package.json"), npmTestPassed)
    }
  })
  function npmTestPassed(err, packageJson) {
    if (err || packageJson.scripts === undefined || packageJson.scripts.start === undefined) {
      striderMessage("could not read package.json to find start command - failing test")
      return cb(1)
    }
    // `npm test` succeeded, so we go through the Sauce tests.

    // Start the app, suggesting a port via PORT environment variable
    var tsh = ctx.shellWrap(packageJson.scripts.start)
    var serverProc = ctx.forkProc({
      args:tsh.args,
      cmd:tsh.cmd,
      cwd:ctx.workingDir,
      env:{PORT:PORT},
    }, function(exitCode) {
      // Could perhaps be backgrounding itself. This should be avoided.
      if (exitCode !== 0 && !startPhaseDone) {
        // If we haven't already called back with completion,
        // and `npm start` exits with non-zero exit code,
        // call back with error and mark done.
        ctx.striderMessage("npm start failed - failing test")
        startPhaseDone = true
        return cb(exitCode)
      }
    })

    // The project webserver should be available via HTTP once started.
    // This section implements a check which will attempt to make a HTTP request for /
    // expecting a 200 response code. It will try RETRIES times, waiting 1 second
    // between checks. If it fails after RETRIES times, the server process will be killed
    // and the test failed.
    var tries = 0
    ctx.striderMessage("Waiting for webserver to come up on localhost:" + PORT)
    var intervalId = setInterval(function() {
      // Check for http status 200 on http://localhost:PORT/
      request("http://localhost:"+PORT+"/", function(err, response) {
        if (startPhaseDone) {
          clearInterval(intervalId)
          return
        }
        if (!err && response.statusCode == 200) {
          ctx.striderMessage("Got HTTP 200 on localhost:" + PORT + " indicating server is up")
          startPhaseDone = true
          clearInterval(intervalId)
          serverUp()
        } else {
          tries++
          console.log("Error on localhost:%d: %s", PORT, err)
          if (tries >= RETRIES) {
            var msg = ("HTTP 200 check on localhost:" + PORT + " failed after " + tries
              + " retries, server not up - failing test")
            ctx.striderMessage(msg)
            clearInterval(intervalId)
            startPhaseDone = true
            return cb(1)
          }
        }
      })
    }, 1000)

    // Start the Sauce Connector. Returns childProcess object.
    function startConnector(username, apiKey, cb) {
      var jarPath = path.join(__dirname, "thirdparty", "Sauce-Connect.jar")
      var jsh = ctx.shellWrap("java -jar " + jarPath + " " + username + " " + apiKey)
      
      ctx.striderMessage("Starting Sauce Connector")
      return ctx.forkProc(__dirname, jsh.cmd, jsh.args, cb)
    }

    // Server is up, start Sauce Connector and run the tests via `npm sauce` invocations
    function serverUp() {
      var done = false
      var connectorProc = startConnector(process.env.SAUCE_USERNAME, process.env.SAUCE_ACCESS_KEY,
        function(exitCode) {
        console.log("Connector exited with code: %d", exitCode)
        if (!done) {
          ctx.striderMessage("Error starting Sauce Connector - failing test")
          ctx.striderMessage("Shutting down server")
          serverProc.kill("SIGKILL")
          done = true
          return cb(1)
        }
      })

      // Wait until connector outputs "You may start your tests"
      // before executing Sauce tests
      connectorProc.stdout.on('data', function(data) {
        if (/Connected! You may start your tests./.exec(data) !== null) {
          var saucesh = ctx.shellWrap("npm run-script sauce")
          //: TODO this should be a loop, executing `npm run-script sauce` for each
          // browser/OS combo specified for the project.
          var sauceProc = ctx.forkProc({
            args: saucesh.args,
            cmd: saucesh.cmd,
            cwd: ctx.workingDir,
            // TODO: Read Sauce creds from Strider per-project storage.
            env: {
              SAUCE_USERNAME:process.env.SAUCE_USERNAME,
              SAUCE_ACCESS_KEY:process.env.SAUCE_ACCESS_KEY
            }
          }, function(code) {
            ctx.striderMessage("npm run-script sauce exited with code " + code)
            if (!done) {
              done = true
              ctx.striderMessage("Shutting down Sauce Connector")
              connectorProc.kill("SIGINT")
              ctx.striderMessage("Shutting down server")
              serverProc.kill()
              // Give Sauce Connector & server 5 seconds to gracefully stop before sending SIGKILL
              setTimeout(function() {
                connectorProc.kill("SIGKILL")
                serverProc.kill("SIGKILL")
                return cb(code)
              }, 5000)
            }
          })
        }
      })
    }
  }
}


module.exports = function(ctx, cb) {

  ctx.addDetectionRule({
    filename:"package.json",
    jsonKeyExists:"scripts.sauce",
    language:"node.js",
    framework:null,
    hasSauce:true,
    prepare:prepare,
    test:test
  })

  console.log("strider-sauce extension loaded")
  cb(null, null)
}
