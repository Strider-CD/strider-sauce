var request = require('request')

// # of tries for webserver to start up on specified port
// We test once per second
var RETRIES = 10

function prepare(ctx, cb) {
  console.log("SAUCE prepare")
  // Start the app, suggesting a port via PORT environment variable
  var tsh = ctx.shellWrap("npm start")
  var serverProc = ctx.forkProc({
    env:{PORT:8031},
    cmd:tsh.cmd,
    args:tsh.args,
  }, function(exitCode) {
    // Could perhaps be backgrounding itself. This should be avoided.
    console.log("serverProc exited with code: %d", exitCode)
  })

  var tries = 0
  ctx.striderMessage("Waiting for webserver to come up on localhost:8031...")
  var intervalId = setInterval(function() {
    // Check for http status 200 on http://localhost:PORT/
    request("http://localhost:8031/", function(err, response) {
      if (!err && response.statusCode == 200) {
        ctx.striderMessage("Got HTTP 200 on localhost:8031 indicating server is up")
        clearInterval(intervalId)
        serverUp()
      } else {
        tries++
        console.log("Error on localhost:8031: %s", err)
        if (tries >= RETRIES) {
          ctx.striderMessage("HTTP 200 check on localhost:8031 failed after " + tries + " retries, aborting test run since server not up")
          clearInterval(intervalId)
          return cb(1)
        }
      }
    })


  }, 1000)

  function serverUp() {
    var tsh = ctx.shellWrap("npm install")
    ctx.forkProc(ctx.workingDir, tsh.cmd, tsh.args, cb)
  }
}

function test(ctx, cb) {
  console.log("SAUCE test")
  var tsh = ctx.shellWrap("npm test")
  ctx.forkProc(ctx.workingDir, tsh.cmd, tsh.args, cb)
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
