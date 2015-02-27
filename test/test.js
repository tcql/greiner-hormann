var gh = require('../'),
  test = require('tape'),
  glob = require('glob'),
  fs = require('fs');


// test('degeneracies', function (t) {
//     var shape0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/degeneracies/shape0.geojson'));
//     var shape1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/degeneracies/shape1.geojson'));
//     var is = intersect(shape0, shape1);
//     fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(is, null, 2))
//     console.log("RESULT:")
//     console.log(is);
//     t.end();
// });


test('armenia', function (t) {

    var armenia = JSON.parse(fs.readFileSync(__dirname+'/fixtures/in/armenia.json'));
    var is = gh.union(armenia[0].geometry.coordinates, armenia[0].geometry.coordinates);
    console.log(is);
    fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(is, null, 2))
    t.end();
})

// test('squares', function (t) {
//   square = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/cut.json'));
//   var is = intersect(square[0], square[1]);
//   fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(is, null, 2))
//   console.log(is);
//   t.end();
// });


// test('squares', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/holes/square0.geojson'));
//   square1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/holes/square1.geojson'));
//   var is = gh.intersect(square0.geometry.coordinates, square1.geometry.coordinates);
//   fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(is, null, 2))
//   console.log(is);
//   t.end();
// });
// test('squares', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square0.geojson'));
//   square1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square1.geojson'));
//   var is = intersect(square0, square1);
//   console.log(is);
//   t.end();
// });

// test('squares -- hole overlaps intersection', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square0.geojson'));
//   square1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square2.geojson'));
//   var is = intersect(square0, square1);
//   console.log(is);
//   fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(is, null, 2))
//   t.end();
// });

// test('squares -- hole inside intersection', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square0.geojson'));
//   square1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square3.geojson'));
//   var is = intersect(square0, square1);
//   console.log(is);
//   fs.writeFileSync(__dirname + '/fixtures/out/test.geojson', JSON.stringify(is, null, 2))
//   t.end();
// });

// test('squares 3', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square0.geojson'));
//   square1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square1.geojson'));
//   intersect(square0, square1, true, false);
//   t.end();
// });

// test('squares 4', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square0.geojson'));
//   square1 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/square1.geojson'));
//   intersect(square0, square1, false, true);
//   t.end();
// });

// test('feature 1', function (t) {
//   square0 = JSON.parse(fs.readFileSync(__dirname + '/fixtures/in/Intersect1.json'));
//   console.log(intersect(square0[0], square0[1], true, false));

//   t.end();
// });

// test('intersect -- features', function(t){
//   glob.sync(__dirname + '/fixtures/in/*.json').forEach(function(input) {
//       var features = JSON.parse(fs.readFileSync(input));
//       var output = intersect(features[0], features[1]);
//       if (REGEN) fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output));
//       t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
//   });
//   t.end();
// });

// test('intersect -- geometries', function(t){
//   glob.sync(__dirname + '/fixtures/in/*.json').forEach(function(input) {
//       var features = JSON.parse(fs.readFileSync(input));
//       var output = intersect(features[0].geometry, features[1].geometry);
//       if (REGEN) fs.writeFileSync(input.replace('/in/', '/out/'), JSON.stringify(output));
//       t.deepEqual(output, JSON.parse(fs.readFileSync(input.replace('/in/', '/out/'))), input);
//   });
//   t.end();
// });

// test('intersect -- no overlap', function(t){
//   var noOverlap = JSON.parse(fs.readFileSync(__dirname+'/fixtures/no-overlap.geojson'));
//   var output = intersect(noOverlap[0].geometry, noOverlap[1].geometry);
//   t.deepEqual(output, undefined);
//   t.end();
// });
