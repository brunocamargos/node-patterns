var request = require('request');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var utilities = require('./utilities');
var TaskQueue = require('./task-queue');

function spiderLinks(currentUrl, body, nesting, callback) {
  if (nesting === 0) {
    return process.nextTick(callback);
  }

  var links = utilities.getPageLinks(currentUrl, body);
  if (links.length === 0) {
    return process.nextTick(callback);
  }

  var completed = 0,
    errored = false;
  var downloadQueue = new TaskQueue(20);
  links.forEach(function(link) {
    downloadQueue.pushTask(function(done) {
      console.log(nesting);
      spider(link, nesting - 1, function(err) {
        if (err) {
          errored = true;
          return callback(err);
        }
        if (++completed === links.length && !errored) {
          callback();
        }
        done();
      });
    });
  });
}

function saveFile(filename, contents, callback) {
  mkdirp(path.dirname(filename), function(err) {
    if (err) {
      return callback(err);
    }
    fs.writeFile(filename, contents, callback);
  });
}

function download(url, filename, callback) {
  console.log('Downloading ' + url);
  request(url, function(err, response, body) {
    if (err) {
      return callback(err);
    }
    saveFile(filename, body, function(err) {
      console.log('Downloaded and saved: ' + url);
      if (err) {
        return callback(err);
      }
      callback(null, body);
    });
  });
}

var spidering = {};

function spider(url, nesting, callback) {
  if (spidering[url]) {
    return process.nextTick(callback);
  }
  spidering[url] = true;

  var filename = utilities.urlToFilename(url);
  fs.readFile(filename, 'utf8', function(err, body) {
    if (err) {
      if (err.code !== 'ENOENT') {
        return callback(err);
      }

      return download(url, filename, function(err, body) {
        if (err) {
          return callback(err);
        }
        spiderLinks(url, body, nesting, callback);
      });
    }

    spiderLinks(url, body, nesting, callback);
  });
}

spider(process.argv[2], 2, function(err, filename) {
  if (err) {
    console.log(err);
    process.exit();
  } else {
    console.log('Download complete');
  }
});