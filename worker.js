var path = require('path')
var request = require('request')

// # of tries for webserver to start up on specified port
// We test once per second
var RETRIES = 10

// Port on which the application-under-test should bind to on localhost.
// Sauce Connector will tunnel from this to Sauce Cloud for Selenium tests
var PORT = 8031

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

//
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

      npmTestPassed()
    }
  })
  function npmTestPassed() {
    // `npm test` succeeded, so we go through the Sauce tests.
    //
    // Start the app, suggesting a port via PORT environment variable
    var tsh = ctx.shellWrap("npm start")
    var serverProc = ctx.forkProc({
      args:tsh.args,
      cmd:tsh.cmd,
      cwd:ctx.workingDir,
      env:{PORT:PORT},
    }, function(exitCode) {
      // Could perhaps be backgrounding itself. This should be avoided.
      console.log("serverProc exited with code: %d", exitCode)
      if (exitCode !== 0 && !startPhaseDone) {
        // If we haven't already called back with completion,
        // and `npm start` exits with non-zero exit code,
        // call back with error and mark done.

        ctx.striderMessage("npm start failed - failing test")
        startPhaseDone = true
        return cb(exitCode)
      }
    })

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
            ctx.striderMessage("HTTP 200 check on localhost:" + PORT + " failed after " + tries + " retries, server not up - failing test")
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

    function serverUp() {
      // Server is up, start Sauce Connector and run the tests via `npm sauce` invocations
      var done = false
      var connectorProc = startConnector(process.env.SAUCE_USERNAME, process.env.SAUCE_ACCESS_KEY,
        function(exitCode) {
        console.log("Connector exited with code: %d", exitCode)
        if (!done) {
          ctx.striderMessage("Error starting Sauce Connector - failing test")
          ctx.striderMessage("Shutting down server")
          serverProc.kill()
          done = true
          return cb(1)

        }
      })
      // Wait until connector outputs "You may start your tests"
      connectorProc.stdout.on('data',function(data) {
        // XXX Add a timeout here
        if (/Connected! You may start your tests./.exec(data) !== null) {
          var saucesh = ctx.shellWrap("npm run-script sauce")
          var sauceProc = ctx.forkProc({
            args: saucesh.args,
            cmd: saucesh.cmd,
            cwd: ctx.workingDir,
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
              // Give Sauce Connector 5 seconds to gracefully stop before sending SIGTERM
              setTimeout(function() {
                connectorProc.kill()
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

  console.log("strider-sauce loaded")
  cb(null, null)

}
