Strider-Sauce
=============

Strider-Suace adds support for easily running Selenium tests in parallel on
Sauce Labs' cloud from within Strider. You simply enter your Sauce Labs
username and access key and select the browser/OS combiniations (including
Windows, Linux, Mac, iOS, Android) on which you want to execute your tests.

You can view a video demo of Strider-Sauce in action on the homepage at
http://strider-cd.com.

Strider-Sauce uses Node.JS `package.json` file conventions, but doesn't
actually care what language your project uses - it only needs to know how to
start your application server and run your Selenium/Sauce tests.

An example application with Strider Sauce tests is available at:

http://github.com/niallo/strider-sauce-sample

Feel free to fork this project to your own account and set it up to play with
Strider-Sauce.

Sauce Test Detection
====================

Strider automatically detects whether or not your project has Selenium/Sauce
tests. It looks for the presence of a file name `package.json` in your project
root, and if found, for the existance of the key `scripts.sauce`.

In other words, it expects contents something like the following:

```javascript
{
  "scripts": {
    "sauce": "sauceTests.js",
    "start": "node app.js",
    "test": "./node_modules/mocha/bin/mocha -R tap"
  }
}
```

If you are using Node.JS, this file should be familiar to you, and for your
project it will contain many other entries. If you are not using Node.JS, you
can still use Strider-Sauce just fine with whatever language you are using. In
both cases, `package.json` is merely a convention for letting Strider know how
to run your tests.

How Test Runs Work
==================


**Dependencies and Unit tests**

Strider will first install dependencies via `npm install` and then run unit
tests via `npm test`. In projects not implemented in Node.JS, these steps
should be no-ops (no dependencies key in `package.json`, `scripts.test` key
should be set to `exit 0`).

**Starting your Web Application Server-under-test**

Assuming the unit tests successfully pass (non-NodeJS projects should set these
to always succeed), Strider will attempt to start your web application server on a
pre-defined port by running the shell command you specify in `package.json` key `scripts.start` **passing in the port to
listen on via a $PORT environment variable** (same convention as used by
Heroku).

Strider waits for your web application server to start by checking for a HTTP
200 reponse on http://localhost:$PORT/ once a second for 10 seconds. If your
web application server returns non-200 response on / or does not listen on
$PORT, the test will be assumed to have failed.

**Starting Sauce Connect**

Once Strider has seen a 200 OK response from the web application
server-under-test, it will automatically start the Sauce Connector with your
Sauce Labs credentials. Strider will intelligently parse Sauce Connector shell
output to know when the connector is ready for tests.

**Starting your Sauce Tests in Parallel**

As soon as the Sauce Connector is ready, Strider will run your Selenium tests in parallel. It does this by executing the shell
command specified in your `package.json` `scripts.sauce` key in **one process for each browser/OS combination selected**. For example,
if you configured your Sauce tests to run on Linux/Chrome and Windows Vista/IE9, Strider would spawn two processes - one for running your tests on Linux/Chrome and one for Windows Vista/IE9.

Each test process will have the browser, browser version and OS specified as
environment variables: `SAUCE_BROWSER`, `SAUCE_BROWSER_VERSION` and `SAUCE_OS`
respectively. It is your responsibility to ensure that these values are
passed-through to your WebDriver connection to the Sauce Labs cloud. Some
Selenium drivers, such as WD.js, are aware of these variables already.

Strider will then wait for each process to complete. Only if every single test
process exits with success will the build pass. In other words, if a single
Selenium test process exits with a non-zero code, the build will fail.


