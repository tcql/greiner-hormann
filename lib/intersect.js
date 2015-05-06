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
  var s_hulls = utils.outerHulls(subject);
  var c_hulls = utils.outerHulls(clipper);
  var holes = utils.holes(subject).concat(utils.holes(clipper));
  var result = [];

  for (var i = 0; i < s_hulls.length; i++) {
    for (var j = 0; j < c_hulls.length; j++) {
      var test = ghClipping(s_hulls[i], c_hulls[j], true, true);
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
