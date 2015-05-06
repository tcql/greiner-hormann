var subtract = require('../').subtract,
  test = require('tape')
  fs = require('fs'),
  glob = require('glob');

test('subtract polygons', function (t) {
  // Run common test cases
  glob.sync(__dirname + '/fixtures/in/common/*.json').forEach(function(input) {
      var features = JSON.parse(fs.readFileSync(input));
      var output = subtract(features[0], features[1]);
      fs.writeFileSync(input.replace('/in/common/', '/out/subtract/'), JSON.stringify(output, null, 2));
      t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/common/', '/out/subtract/'))), input);
  });

  // Run specific test cases
  glob.sync(__dirname + '/fixtures/in/subtract/*.json').forEach(function(input) {
      var features = JSON.parse(fs.readFileSync(input));
      var output = subtract(features[0], features[1]);
      fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output, null, 2));
      t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
  });
  t.end();
});
