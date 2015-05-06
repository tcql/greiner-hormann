var union = require('../').union,
  test = require('tape'),
  glob = require('glob'),
  fs = require('fs');

test('union polygons', function (t) {
  // Run common test cases
  glob.sync(__dirname + '/fixtures/in/common/*.json').forEach(function(input) {
      var features = JSON.parse(fs.readFileSync(input));
      var output = union(features[0], features[1]);
      fs.writeFileSync(input.replace('/in/common/', '/out/union/'), JSON.stringify(output, null, 2));
      t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/common/', '/out/union/'))), input);
  });

  // Run specific test cases
  glob.sync(__dirname + '/fixtures/in/union/*.json').forEach(function(input) {
      var features = JSON.parse(fs.readFileSync(input));
      var output = union(features[0], features[1]);
      fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output, null, 2));
      // t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
  });
  t.end();
});

// test('union polygons in one set', function (t) {
//   var input = __dirname+'/fixtures/in/union/Union1.json'
//   var polys = JSON.parse(fs.readFileSync(input));
//   var u = union(polys);
//   t.deepEqual(u, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))));
//   t.end();
// });
