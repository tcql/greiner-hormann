var utils = require('../lib/util'),
  test = require('tape');

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

test('is multipolygon', function (t) {
    var ismulti = utils.isMultiPolygon(polys[0]);
    t.ok(ismulti)
    t.end();
});

test('isnt multipolygon', function (t) {
    var ismulti = utils.isMultiPolygon(polys[1]);
    t.notOk(ismulti)
    t.end();
});

test('is polygon', function (t) {
    var ispoly = utils.isPolygon(polys[1]);
    t.ok(ispoly)
    t.end();
});

test('isnt polygon', function (t) {
    var ispoly = utils.isPolygon(polys[0]);
    t.notOk(ispoly)
    t.end();
});

test('outer hulls', function (t) {
    var expect = [
        [ [ 0, 0 ], [ 1, 1 ] ],
        [ [ 0, 0 ], [ 2, 2 ] ],
        [ [ 4, 4 ], [ 5, 5 ] ]
    ];

    var hulls = utils.outerHulls(polys);
    t.deepEqual(hulls, expect);
    t.end();
});

test('holes', function (t) {
    var expect = [
        [ [2, 2], [3, 3] ],
        [ [6, 6], [7, 7] ]
    ];

    var holes = utils.holes(polys);
    t.deepEqual(holes, expect);
    t.end();
});
