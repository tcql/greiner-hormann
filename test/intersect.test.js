var intersect = require('../').intersect,
  test = require('tap').test,
  fs = require('fs'),
  glob = require('glob');

var REGEN = process.env.REGEN || false;


// Run common test cases
glob.sync(__dirname + '/fixtures/in/common/*.json').forEach(function(input) {
  var name = input.split('/');
  test('intersect -- ' + name[name.length - 1], function (t) {
    var features = JSON.parse(fs.readFileSync(input));
    var output = intersect(features[0], features[1]);
    if (REGEN) {
      fs.writeFileSync(input.replace('/in/common/', '/out/intersect/'), JSON.stringify(output, null, 2));
    }
    t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/common/', '/out/intersect/'))), input);
    t.end();
  });
});

// Run specific test cases
glob.sync(__dirname + '/fixtures/in/intersect/*.json').forEach(function(input) {
  var name = input.split('/');
  test('intersect -- ' + name[name.length - 1], function (t) {
    var features = JSON.parse(fs.readFileSync(input));
    var output = intersect(features[0], features[1]);
    if (REGEN) {
      fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output, null, 2));
    }
    t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
    t.end();
  });
});
