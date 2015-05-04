var intersect = require('../').intersect,
  test = require('tape'),
  glob = require('glob'),
  fs = require('fs'),
  polygon = require('turf-polygon');


test('intersect polygons', function (t) {
  glob.sync(__dirname + '/fixtures/in/intersect/*.json').forEach(function(input) {
    console.log(input);
    var features = JSON.parse(fs.readFileSync(input));
    var output = intersect(features[0], features[1]);
    fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(polygon(output[0]), null, 2))
    console.log(output[0]);
    console.log(output);
      // t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
  });
  t.end();
});
