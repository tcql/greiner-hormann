var gh = require('./');
var Benchmark = require('benchmark');
var fs = require('fs');

var armenia = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/armenia.json'));
var simple = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/Intersect1.json'));
var suite = new Benchmark.Suite('turf-intersect');
suite
  .add('turf-intersect#simple',function () {
    gh.intersect(simple[0].geometry.coordinates, simple[1].geometry.coordinates);
  })
  .add('turf-intersect#armenia',function () {
    gh.intersect(armenia[0].geometry.coordinates, armenia[1].geometry.coordinates);
  })
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {

  })
  .run();
