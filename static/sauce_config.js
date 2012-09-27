define(
  ['apres', 'jquery'],
  function(apres, $) {
    var SauceConfigWidget = function(elem, params) {
      var params = apres.controller().params;
      this.events = {
        "click #sauce-save": function() {
          console.log("sauce click");
          var sauce_username = elem.find(".sauce-username");
          var sauce_access_key = elem.find(".sauce-access-key");
          $.ajax("/api/sauce/config", {
                data: {url:params.repo_url, sauce_username:sauce_username, sauce_access_key:sauce_access_key},
                error: function(xhr, ts, e) {
                  $(".alert")
                    .removeClass().addClass("alert alert-error").html("Error saving sauce credentials.");
                },
                success: function(data, ts, xhr) {
                  $(".alert")
                    .removeClass().addClass("alert alert-success").html("Sauce credentials saved.");
                },
                type: "POST",
          });
        }
      };
    };

    return SauceConfigWidget;
  }
);
