var subtract = require('../').subtract,
  test = require('tape')
  fs = require('fs'),
  glob = require('glob');

test('subtract polygons', function (t) {
  glob.sync(__dirname + '/fixtures/in/subtract/Simple.json').forEach(function(input) {
      var features = JSON.parse(fs.readFileSync(input));
      var output = subtract(features[0], features[1]);
      fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output, null, 2));
      t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
  });
  t.end();
});
