var ghClipping = require('./lib/greiner-hormann');
var turfInside = require('turf-inside');
var turfPoint = require('turf-point');
var turfPolygon = require('turf-polygon');
var union = require('./lib/union');
var util = require('./lib/util');

module.exports = function(subject, clipper) {
  // TODO: make this work with more interesting geometries
  var subCoords = subject.geometry ? subject.geometry.coordinates : subject.coordinates;
  var clipCoords = clipper.geometry ? clipper.geometry.coordinates : clipper.coordinates;

  // According to GeoJSON spec, the first element in a set of polygon rings
  // *MUST* be the outer ring. So that's where we start.
  var intersect = ghClipping(subCoords[0], clipCoords[0], true, true);

  if (!intersect) {
    intersect = [];
  }

  // To deal with holes, get all holes for both polygons
  var originalHoles =subCoords.slice(1).concat(clipCoords.slice(1));


  // clip holes against the intersection areas to find if any
  // of them cut into the intersection hulls. If they don't,
  // they'll be returned in the array as rings
  intersect = clipHoles(originalHoles, intersect);

  if (intersect.length == 0) {
    // console.log("No intersection")
    // TODO: Handle this?
  } else if (intersect.length == 1) {
    return turfPolygon(intersect[0]);
  } else {
    return {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": intersect
      }
    };
  }
}

/**
 * Handles dealing with holes from the source/clip polygons
 *
 * @param  {[type]} holes     [description]
 * @param  {[type]} intersect [description]
 * @return {[type]}           [description]
 */
function clipHoles(holes, intersect) {
  if (holes.length > 0) {
    holes = union(holes);

    // Next we'll subtract each hole from each intersection polygon.
    for (var i = 0; i < holes.length; i++) {
      var ilen = intersect.length;
      for (var j = 0; j < intersect.length; j++) {
        var test = ghClipping(intersect[j][0], holes[i], false, true);

        // Copy the primary hull of the intersect record that
        // we just clipped against the hull
        intersect[j][0] = test[0][0];

        // Copy in each hole (if there were any) for the primary hull
        for (var k = 1; k < test[0].length; k++) {
          intersect[j].push(test[0][k]);
        }

        // If there are any additional polygons in the result,
        // they were newly created by intersecting this hole.
        // Push the new polygon (hull and any holes) straight
        // into the intersect list
        for (var k = 1; k < test.length; k++) {
          intersect.push(test[k]);
        }
      }

      // If the length has changed, this hole created
      // new intersection polygons, which means it's not a hole
      // anymore (it crossed the polys, now it's boundary is
      // part of the new intersection hulls). Therefore, we
      // remove this hole from the list so it won't be returned.
      if (ilen != intersect.length) {
        holes.splice(i)
        i--;
      }
    }

    // if (holes.length > 0) {
    //   intersect = intersect.concat(holes);
    // }
  }
  return intersect;
}

/**
 * When dealing with holes, the first step is to union all the
 * holes against eachother, to deal with casess where any of the
 * holes overlap eachother. This can occur when the subject and
 * clip polygon each had a hole in an overlapping area.
 *
 * @param  {[type]} holes [description]
 * @return array  The list of hole polygons
 */
function unionHoles(holes) {
  // First, we'll union the holes, to handle any
  // cases where the holes overlap (could happen if
  // both subject AND clip had holes)
  for (var i = 0; i < holes.length; i++) {
    for (var j = i+1; j < holes.length; j++) {
      if (holes[i] == holes[j]) continue;
      var test = ghClipping(holes[i], holes[j], false, false);
      if (test.length == 1) {
        holes[i] = test[0][0];
        holes.splice(j);
        j--;
      }
    }
  }
  return holes;
}
