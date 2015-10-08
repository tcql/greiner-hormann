var union = require('../').union,
  test = require('tap').test,
  glob = require('glob'),
  fs = require('fs');

var REGEN = process.env.REGEN || false;

// Run common test cases
glob.sync(__dirname + '/fixtures/in/common/*.json').forEach(function(input) {
  var name = input.split('/');
  test('union -- ' + name[name.length - 1], function (t) {
    var features = JSON.parse(fs.readFileSync(input));
    var output = union(features[0], features[1]);
    if (REGEN) {
      fs.writeFileSync(input.replace('/in/common/', '/out/union/'), JSON.stringify(output, null, 2));
    }
    t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/common/', '/out/union/'))), input);
    t.end();
  });
});

// Run specific test cases
glob.sync(__dirname + '/fixtures/in/union/*.json').forEach(function(input) {
  var name = input.split('/');
  test('union -- ' + name[name.length - 1], function (t) {
    var features = JSON.parse(fs.readFileSync(input));
    var output = union(features[0], features[1]);
    if (REGEN) {
      fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output, null, 2));
    }
    t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
    t.end();
  });
});

