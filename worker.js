var request = require('request')

// # of tries for webserver to start up on specified port
// We test once per second
var RETRIES = 10

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
      env:{PORT:8031},
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
    ctx.striderMessage("Waiting for webserver to come up on localhost:8031...")
    var intervalId = setInterval(function() {
      // Check for http status 200 on http://localhost:PORT/
      request("http://localhost:8031/", function(err, response) {
        if (startPhaseDone) {
          clearInterval(intervalId)
          return
        }
        if (!err && response.statusCode == 200) {
          ctx.striderMessage("Got HTTP 200 on localhost:8031 indicating server is up")
          startPhaseDone = true
          clearInterval(intervalId)
          serverUp()
        } else {
          tries++
          console.log("Error on localhost:8031: %s", err)
          if (tries >= RETRIES) {
            ctx.striderMessage("HTTP 200 check on localhost:8031 failed after " + tries + " retries, server not up - failing test")
            clearInterval(intervalId)
            startPhaseDone = true
            return cb(1)
          }
        }
      })


    }, 1000)

    function serverUp() {
      // Server is up, start Sauce Connector and run the tests via `npm sauce` invocations
      ctx.striderMessage("Shutting down server")
      serverProc.kill()

      return cb(1)
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
