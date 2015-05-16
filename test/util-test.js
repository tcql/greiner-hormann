var utils = require('../lib/util'),
  test = require('tape'),
  Ring = require('../lib/ring');


// Note... these aren't valid polygons at all
var polys = [
    [ // MultiPolygon
        [ // Polygon
            [ [0, 0], [1, 1] ],
            [ [2, 2], [3, 3] ] // Hole
        ],
        [ // Polygon
            [ [0, 0], [2, 2] ],
        ]
    ],

    [ // Polygon
        [ [4, 4], [5, 5] ],
        [ [6, 6], [7, 7] ]
    ]
];

test('outer hulls', function (t) {
    var expect = [
        [ [ 0, 0 ], [ 1, 1 ] ],
        [ [ 0, 0 ], [ 2, 2 ] ],
        [ [ 4, 4 ], [ 5, 5 ] ]
    ];

    var hulls = utils.outerHulls(utils.coordsToStructured(polys));
    t.deepEqual(hulls, expect);
    t.end();
});

test('holes', function (t) {
    var expect = [
        [ [2, 2], [3, 3] ],
        [ [6, 6], [7, 7] ]
    ];

    var holes = utils.holes(utils.coordsToStructured(polys));
    t.deepEqual(holes, expect);
    t.end();
});


test('asRings -- polygon', function (t) {
    var expect = [
        {
            hull: Ring.fromArray(polys[1][0]),
            holes: [ Ring.fromArray(polys[1][1]) ]
        }
    ];
    var rings = utils.asRings(utils.coordsToStructured(polys[1]));

    t.ok(Array.isArray(rings), 'result is an array of rings');
    t.equal(expect[0].hull.first.x, rings[0].hull.first.x, 'first coordinate x equals');
    t.equal(expect[0].hull.first.y, rings[0].hull.first.y, 'first coordinate y equals');
    t.end();
});

test('asRings -- multipolygon', function (t) {
    var expect = [
        {
            hull: Ring.fromArray(polys[0][0][0]),
            holes: [ Ring.fromArray(polys[0][0][1]) ]
        },
        {
            hull: Ring.fromArray(polys[0][1][0]),
            holes: []
        }

    ];
    var rings = utils.asRings(utils.coordsToStructured(polys[0]));

    t.ok(Array.isArray(rings), 'result is an array of rings');
    t.equal(expect[0].hull.first.x, rings[0].hull.first.x, 'first coordinate x equals');
    t.equal(expect[0].hull.first.y, rings[0].hull.first.y, 'first coordinate y equals');
    t.end();
});


test('coordsToStructured -- polygon', function (t) {
    var struc = utils.coordsToStructured(polys[1]);
    t.deepEqual(polys[1][0], struc[0].hull, 'Polygon hull')
    t.deepEqual(polys[1][1], struc[0].holes[0], 'Polygon hole')
    t.equal(struc.length, 1, 'Only one structured object');
    t.end();
});

test('coordsToStructured -- multipolygon', function (t) {
    var struc = utils.coordsToStructured(polys[0]);
    t.deepEqual(polys[0][0][0], struc[0].hull, 'Multipolygon P1 hull')
    t.deepEqual(polys[0][0][1], struc[0].holes[0], 'Multipolygon P1 hole')
    t.equal(struc.length, 2, 'Two structured objects');
    t.end();
});

test('coordsToStructured -- all', function (t) {
    var struc = utils.coordsToStructured(polys);
    t.deepEqual(polys[0][0][0], struc[0].hull, 'Multipolygon P1 hull');
    t.deepEqual(polys[0][1][0], struc[1].hull, 'MultiPolygon P2 hull');
    t.deepEqual(polys[1][0], struc[2].hull, 'Polygon hull');
    t.end();
});


test('coordsToStructured -- twice', function (t) {
    var struc = utils.coordsToStructured(polys);
    var struc2 = utils.coordsToStructured(struc);

    t.deepEqual(struc, struc2, "Calling coordsToStructured twice should have no effect");
    t.end();
})
