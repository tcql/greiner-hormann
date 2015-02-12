var union = require('../').union,
  test = require('tape')
  fs = require('fs');


test('union polygons in one set', function (t) {
  var polys = JSON.parse(fs.readFileSync(__dirname+'/fixtures/in/union/Union1.json'));
  var u = union(polys[0]);
  t.deepEqual(u, polys[1]);
  t.end();
});

test('union polys in two sets', function (t) {
  var polys = JSON.parse(fs.readFileSync(__dirname+'/fixtures/in/union/Union1.json'));
  var p1 = polys[0].slice(0, 2);
  var p2 = polys[0].slice(2);
  var u = union(p1, p2);
  t.deepEqual(u, polys[1]);
  t.end();
});
