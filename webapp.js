//
// Strider Webapp extension for Sauce Labs tests
//

/*
 * GET /api/sauce/
 *
 * Get the current Strider config for specified project. This will be a JSON-encoded
 * object with the keys: sauce_username, sauce_access_key and sauce_browsers
 *
 * @param url Github html_url of the project.
 */
function getIndex(req, res) {
  console.log("get index");
  var url = req.param("url");

  function error(err_msg) {
    console.error("Strider-Sauce: getIndex() - %s", err_msg);
    var r = {
      errors: [err_msg],
      status: "error"
    };
    res.statusCode = 400;
    return res.end(JSON.stringify(r, null, '\t'));
  };

  Step(
    function() {
        req.user.get_repo_config(url, this);
    },
    function(err, repo, access_level, owner_user_obj) {
      if (err) {
        return error("Error fetching Repo Config for url " + url + ": " + err);
      }
      this.collabs = repo.collaborators;
      this.owner_user_obj = owner_user_obj;
      // Look up emails for each collaborator
      var group = this.group();
      _.each(repo.collaborators, function(c) {
        models.User.findOne({"_id":c.user_id}, {"email":1}, group());
      });
    },
    function(err, results) {
      if (err) {
        return error("Error fetching collaborator emails: " + err);
      }
      // Build a whitelist to output directly as JSON
      var id_email_map = {};
      _.each(results, function(user) {
        id_email_map[user._id] = user.email;
      });
      var whitelist = [];
      _.each(this.collabs, function(c) {
        whitelist.push({
          type: "user",
          email: id_email_map[c.user_id],
          access_level: c.access_level,
          owner: false,
          gravatar: email_to_gravatar(id_email_map[c.user_id]),
        });
      });
      // Synthesize the owner as a collaborator
      whitelist.push({type:"user", user_id: this.owner_user_obj._id,
        access_level: 1, email: this.owner_user_obj.email, owner:true,
        gravatar: email_to_gravatar(this.owner_user_obj.email)});
      var r = {
        status: "ok",
        errors: [],
        results: whitelist
      };
      return res.end(JSON.stringify(r, null, '\t'));
    }
  )
}

function postIndex(req, res) {
  console.log("post index")
  return res.end("ok")

}


module.exports = function(ctx, cb) {


  function saucePlugin(schema, opts) {
    schema.add({
      sauce_access_key: String,
      sauce_username: String,
      sauce_browsers: [],
    })
  }

  // Extend RepoConfig model with 'Sauce' properties
  ctx.models.RepoConfig.plugin(saucePlugin)

  // Add webserver routes
  ctx.route.get("/api/sauce",
    ctx.middleware.require_auth,
    ctx.middleware.require_params(["url"]),
    getIndex)
  ctx.route.post("/api/sauce",
    ctx.middleware.require_auth,
    ctx.middleware.require_params(["url"]),
    postIndex)


  console.log("strider-sauce webapp extension loaded")

  cb(null, null)


}
