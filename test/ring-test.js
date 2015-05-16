var utils = require('../lib/util'),
  test = require('tape'),
  Ring = require('../lib/ring');

test('Ring won\'t try converting a Ring twice', function (t) {
    var coords = [ [0, 0], [1, 1] ];
    var ring = Ring.fromArray(coords);
    var ring2 = Ring.fromArray(ring);

    t.equal(ring, ring2, 'Ring.fromArray twice equals Ring.fromArray once');
    t.equal(ring.first.x, 0, 'First coordinate is correct');
    t.end();
})
