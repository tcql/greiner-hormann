var gh = require('./');
var Benchmark = require('benchmark');
var fs = require('fs');

var armenia = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/armenia.json'));
var simple = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/Intersect1.json'));
var degenerate = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/common/Degenerate.json'));
var huge2 = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/common/Huge2.json'));
var huge = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/common/Huge.json'));
var hugeSC = JSON.parse(fs.readFileSync(__dirname+'/test/fixtures/in/common/20190.json'));

var suite = new Benchmark.Suite('turf-intersect');
suite
  .add('intersect#simple',function () {
    gh.intersect(simple[0].geometry.coordinates, simple[1].geometry.coordinates);
  })
  .add('intersect#armenia',function () {
    gh.intersect(armenia[0].geometry.coordinates, armenia[1].geometry.coordinates);
  })
  .add('intersect#degenerate', function () {
    gh.intersect(degenerate[0], degenerate[1]);
  })
  .add('intersect#huge', function () {
    gh.intersect(huge[0], huge[1]);
  })
  .add('intersect#huge-multi, no artifact', function () {
    gh.intersect(huge2[0], huge2[1]);
  })
  .add('intersect#huge S&C', function () {
    gh.intersect(hugeSC[0], hugeSC[1]);
  })
  .add('subtract#degenerate', function () {
    gh.subtract(degenerate[0], degenerate[1]);
  })
  .add('subtract#huge', function () {
    gh.subtract(huge[0], huge[1]);
  })
  .add('subtract#huge-multi, no artifact', function () {
    gh.subtract(huge2[0], huge2[1]);
  })
  .add('subtract#huge S&C', function () {
    gh.subtract(hugeSC[0], hugeSC[1]);
  })
  .add('union#degenerate', function () {
    gh.union(degenerate[0], degenerate[1]);
  })
  .add('union#huge', function () {
    gh.union(huge[0], huge[1]);
  })
  .add('union#huge-multi, no artifact', function () {
    gh.union(huge2[0], huge2[1]);
  })
  .add('union#huge S&C', function () {
    gh.union(hugeSC[0], hugeSC[1]);
  })
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {

  })
  .run();
