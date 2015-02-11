var ghClipping = require('./greiner-hormann');
var turfInside = require('turf-inside');
var turfPoint = require('turf-point');
var turfPolygon = require('turf-polygon');
var union = require('./union');
var utils = require('./util');
var subtract = require('./subtract');

module.exports = function(subject, clipper) {
  // According to GeoJSON spec, the first element in a set of polygon rings
  // *MUST* be the outer ring. So that's where we start.
  var intersect = ghClipping(subject[0], clipper[0], true, true);

  if (!intersect) {
    intersect = [];
  }

  // To deal with holes, get all holes for both polygons
  var holes = utils.holes([subject, clipper]);

  if (holes.length > 0) {
    // Union the holes together (in case any overlapped)
    holes = union(holes);
    // Subtract them from the intersection (in case any overlap the
    // intersection edges)
    intersect = subtract(intersect, holes);
  }

  return intersect;
}
