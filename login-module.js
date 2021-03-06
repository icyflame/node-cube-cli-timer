var clc = require('cli-color');

var username, password, twoFactorCode;

var read = require('read');
var request = require('request-json');
var Configstore = require('configstore');
var pkg = require('./package.json');

var handle_success = function (err, res, body) {
  var conf = new Configstore(pkg.name);

  conf.set('username', username);
  conf.set('oauth_token', body.token);

  console.log(clc.green('Authenticated!') + ' We have stored your OAuth Token in the ~/.config directory.');

  if (conf.get('gist_id')) {
    var ghGistOwner = require('gh-gist-owner');
    var owner_username = ghGistOwner(conf.get('gist_id'));
    if (username !== owner_username) {
      console.log('Gist ID: ' + conf.get('gist_id') + ' was stored on file.');
      console.log('It is owned by ' + owner_username + '. We are removing this from local storage.');
      conf.del('gist_id');
    } else {
      console.log('Gist ID: ' + conf.get('gist_id') + ' will be used for pushing solves.');
    }
  }
}

var handle_error = function (err, res, body) {
  console.log('HTTP Status Code: ' + res.statusCode);
  console.log('Headers: ', require('util').inspect(res.headers));
  console.log('We encountered an error!');
};

module.exports = function () {

  console.log(clc.blue('Welcome to the one-time-authentication module.'));
  console.log('This module will take your github username and password\nand exchange it for an OAuth token');

  read({
    prompt: 'Enter your GitHub username: '

  }, function (err, result, isDef) {
    if (err) {
      console.log(require('util').inspect(err, { depth: null }));
    }
    username = result;

    read({
      prompt: 'Enter your GitHub password: ',
      silent: true

    }, function (err, result, isDef) {
      if (err) {
        console.log(require('util').inspect(err, { depth: null }));
        return;
      }
      password = result;

      var client = request.createClient('https://api.github.com/');

      client.setBasicAuth(username, password);

      var data = {
        'scopes': ['gist'],
        'note': 'OAuth token for node-cube-cli-timer.',
        'client_id': '678a9606a01d79c24046',
        'client_secret': '266c833862498ac55856cf276a26c8b680515e91'
      };

      client.post('authorizations', data, function (err, res, body) {
        if (res.statusCode === 401 && !err && res.headers['x-github-otp']) {
          console.log(clc.green("2FA enabled! I see you care about security."));
          let twoFacPrompt = "Please enter your 2FA code ( " + res.headers['x-github-otp'] + " ): ";

          read({
            prompt: twoFacPrompt

          }, function (err, result, isDef) {
            if (err) {
              console.log(require('util').inspect(err, { depth: null }));
              return;
            }

            twoFactorCode = result;

            client.headers['x-github-otp'] = twoFactorCode;

            client.post('authorizations', data, function (err, res, body) {
              if (res.statusCode === 201 && !err) {
                handle_success(err, res, body);
              } else {
                handle_error(err, res, body);
              }
            });
          });
        } else if (res.statusCode === 201 && !err) {
          handle_success(err, res, body);
        } else {
          handle_error(err, res, body);
        }
      });

    });
  });

};
