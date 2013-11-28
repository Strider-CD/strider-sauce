
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
    browserName: parts[1],
    version: parts[2] || ''
  };
}

function serializeName(browser) {
  return browser.platform + '-' + browser.browserName + '-' + browser.version;
}

app.controller('SauceCtrl', ['$scope', function ($scope) {
  $scope.$watch('configs[branch.name].sauce.config', function (value) {
    $scope.config = value;
    if (!value) return;
    $scope.browser_map = {};
    if (!value.browsers) {
      value.browsers = [];
    }
    for (var i=0; i<value.browsers.length; i++) {
      $scope.browser_map[serializeName(value.browsers[i])] = true;
    }
    $scope.proxies = $scope.config && $scope.config.proxies ? $scope.config.proxies : [];
  });
  $scope.completeName = completeName;
  $scope.operatingsystems = organize(browsers || []);

  $scope.save = function () {
    console.log($scope.proxies);
    $scope.config.browsers = [];
    
    $scope.config.proxies = [];
    for (var rawproxy in $scope.proxies) {
      var currentProxy = $scope.proxies[rawproxy];
      $scope.config.proxies.push({name: currentProxy.name , value: currentProxy.value});
    }

    for (var name in $scope.browser_map) {
      if ($scope.browser_map[name]) {
        $scope.config.browsers.push(parseName(name));
      }
    }
    $scope.pluginConfig('sauce', $scope.config, function () {
    });
  };
  $scope.clear = function () {
    $scope.browser_map = {};
    $scope.$digest();
  };
  $scope.addProxy = function () {
    var currentProxy = {
      name:$scope.proxyName,
      value:$scope.proxyValue
    };
    $scope.proxies.push(currentProxy);
    $scope.proxyName = "";
    $scope.proxyValue = "";
  };

  $scope.removeProxy = function (index) {
    $scope.proxies.splice(index, 1);
  };

  $scope.getProxies = function () {
    return $scope.proxies;
  }
}]);
