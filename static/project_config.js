
(function(){

  function organize(browsers) {
    var oss = {};
    for (var i=0; i<browsers.length; i++) {
      if (!oss[browsers[i].os]) {
        oss[browsers[i].os] = {};
      }
      if (!oss[browsers[i].os][browsers[i].long_name]) {
        oss[browsers[i].os][browsers[i].long_name] = [];
      }
      oss[browsers[i].os][browsers[i].long_name].push(browsers[i]);
      browsers[i].complete_name = completeName(browsers[i]);
    }
    return oss;
  }

  function completeName(version) {
    return version.os + '-' + version.api_name + '-' + version.short_version;
  }

  function parseName(name) {
    var parts = name.split('-');
    return {
      platform: parts[0],
      browser: parts[1],
      version: parts[2] || ''
    };
  }

  function serializeName(browser) {
    return browser.platform + '-' + browser.browser + '-' + browser.version;
  }

  function save(url, data, done) {
    data = _.extend({url: url}, data);
    data.sauce_browsers = JSON.stringify(data.sauce_browsers);
    $.ajax({
      url: '/api/sauce',
      type: 'POST',
      data: data,
      dataType: 'json',
      success: function (data, ts, xhr) {
        done(null);
      },
      error: function (xhr, ts, e) {
        if (xhr && xhr.responseText) {
          var data = $.parseJSON(xhr.responseText);
          e = data.errors[0];
        }
        done(e);
      }
    });
  }

  app.controller('SauceCtrl', ['$scope', function ($scope) {
    $scope.data = $scope.panelData.sauce_config;
    $scope.completeName = completeName;
    $scope.operatingsystems = organize(browsers);
    $scope.browser_map = {};
    for (var i=0; i<$scope.data.sauce_browsers.length; i++) {
      $scope.browser_map[serializeName($scope.data.sauce_browsers[i])] = true;
    }
    $scope.save = function () {
      $scope.data.sauce_browsers = [];
      for (var name in $scope.browser_map) {
        if ($scope.browser_map[name]) {
          $scope.data.sauce_browsers.push(parseName(name));
        }
      }
      save($scope.repo.url, $scope.data, function (err) {
        if (err) {
          $scope.error('Failed to save sauce settings: ' + err);
        } else {
          $scope.success('Saved sauce settings');
        }
        $scope.$root.$digest();
      });
    };
    $scope.clear = function () {
      $scope.browser_map = {};
    };
  }]);

})();
