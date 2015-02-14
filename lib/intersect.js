var ghClipping = require('./greiner-hormann');
var turfInside = require('turf-inside');
var turfPoint = require('turf-point');
var turfPolygon = require('turf-polygon');
var union = require('./union');
var utils = require('./util');
var subtract = require('./subtract');

module.exports = function(subject, clipper) {
  var subject = utils.clone(subject);
  var clipper = utils.clone(clipper);
  var hulls = utils.outerHulls(subject).concat(utils.outerHulls(clipper));
  var holes = utils.holes(subject).concat(utils.holes(clipper));
  var result = [];

  // Intersect all hulls
  for (var i = 0; i < hulls.length; i++) {
    for (var j = i+1; j < hulls.length; j++) {
      var test = ghClipping(hulls[i], hulls[j], true, true);
      if (Array.isArray(test)) {
        result = result.concat(test);
      }
    }
  }

  // Union all the holes then subtract them rom the result
  if (holes.length > 0) {
    var holeUnion = union(holes);
    return subtract(result, utils.outerHulls(holeUnion));
  }

  return result;
}
