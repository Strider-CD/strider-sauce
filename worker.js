function prepare(ctx, cb) {
  console.log("SAUCE prepare")
  var tsh = ctx.shellWrap("npm install")
  forkProc(self.workingDir, tsh.cmd, tsh.args, cb)
}

function test(ctx, cb) {
  console.log("SAUCE test")
  var tsh = ctx.shellWrap("npm test")
  forkProc(self.workingDir, tsh.cmd, tsh.args, cb)
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

}
