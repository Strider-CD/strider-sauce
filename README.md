Strider-Sauce
=============

Strider-Sauce adds support for easily running [Selenium][selenium] tests in parallel on
[Sauce Labs'][saucelabs] cloud from within Strider. You simply enter your Sauce Labs
username and access key and select the browser/OS combinations (including
Windows, Linux, Mac, iOS, Android) on which you want to execute your tests.

## Usage

This plugin runs [SauceConnect][sauce-connect] in the 'Prepare' phase so that any server that your job runs will be
proxied to the SauceLabs servers for running your tests on various browsers.

After setting up `strider-sauce`, you need to run your server on one of the [SauceLabs proxy ports][proxy-ports]
and then you can run your Selenium tests.

[selenium]: http://www.seleniumhq.org/
[saucelabs]: https://saucelabs.com/
[sauce-connect]: https://docs.saucelabs.com/reference/sauce-connect/
[proxy-ports]: https://docs.saucelabs.com/reference/sauce-connect/#can-i-access-applications-on-localhost-
