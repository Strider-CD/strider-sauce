//
// Strider Webapp extension for Sauce Labs tests
//

var path = require('path')

module.exports = {
  // Mongoose model
  config: {
    access_key: String,
    username: String,
    browsers: [],
  }
}
