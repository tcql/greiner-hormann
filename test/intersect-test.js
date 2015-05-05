var intersect = require('../').intersect,
  test = require('tape')
  fs = require('fs'),
  glob = require('glob');

test('intersect polygons', function (t) {
  glob.sync(__dirname + '/fixtures/in/intersect/*.json').forEach(function(input) {
      var features = JSON.parse(fs.readFileSync(input));
      var output = intersect(features[0], features[1]);
      fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output, null, 2));
      t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
  });
  t.end();
});
