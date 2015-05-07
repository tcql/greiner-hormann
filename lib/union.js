var ghClipping = require('./greiner-hormann');
var utils = require('./util');
var subtract = require('./subtract');

/**
 * Iteratively join all rings in the passed set.
 *
 * @param  {array} rings An array of polygon rings
 * @return {[type]}       [description]
 */
function unionRings(s_hulls, c_hulls, holes)
{
  var step = 0;
  var rings = [];
  for (var i = 0; i < s_hulls.length; i++) {
    for (var j = 0; j < c_hulls.length; j++) {
      var test = ghClipping(s_hulls[i], c_hulls[j], false, false);

      // If the length is 1, we joined the two areas, so replace
      // rings[i] with the new shape, and remove rings[j]
      // Then reset the j iterator so we can make sure that none of
      // the previous rings will now overlap the new rings[i]
      if (test.length == 1) {
        rings.push(test[0][0])

        // If there are holes, copy them into the holes array.
        if (test[0].length > 1) {
          test[0].forEach(function(elem, idx) {
            if (idx != 0) {
              holes.push(elem);
            }
          });
        }
      } else {
        rings.push(s_hulls[i]);
        rings.push(c_hulls[j]);
      }
    }
  }
  return rings;
}

// TODO: make this support polys + holes. Right now
// it takes an array of rings, not array of polys.
//
// TODO: think about the function signature here? Should it be
// traditional "union A + B", or is passing a set of things to union more useful
//
// TODO: think about using the approach here: http://blog.cleverelephant.ca/2009/01/must-faster-unions-in-postgis-14.html
// to make things faster for complex / very degenerate sets
module.exports = function(coords, coords2) {
  // if (typeof coords2 != 'undefined' && coords2 != null) {
  //   // TODO: make this more robust. This will fail in some cases
  //   if (!utils.isMultiPolygon(coords)) {
  //     coords = [coords];
  //   }
  //   if (!utils.isMultiPolygon(coords2)) {
  //     coords2 = [coords2];
  //   }
  //   coords = coords.concat(coords2)
  // }
  coords = utils.clone(coords);
  coords2 = utils.clone(coords2);
  var s_hulls = utils.outerHulls(coords);
  var c_hulls = utils.outerHulls(coords2);
  var holes = utils.holes(coords);

  // Union all hulls. Holes is passed in, to handle cases where the union
  // generates new holes (they'll be pushed into the holes array)
  hulls = utils.wrapToPolygons(unionRings(s_hulls, c_hulls, holes));

  // Union all holes - If holes overlap, they should be joined
  // if (holes.length > 0) {
  //   holes = unionRings(holes);
  //   holes = utils.wrapToPolygons(holes);
  //   // Subtract all rings from the unioned set
  //   return subtract(hulls, holes);
  // }

  return hulls;
}
