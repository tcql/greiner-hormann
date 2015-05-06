var ghClipping = require('./greiner-hormann');
var utils = require('./util');
var subtract = require('./subtract');

/**
 * Iteratively join all rings in the passed set.
 *
 * @param  {array} rings An array of polygon rings
 * @return {[type]}       [description]
 */
function unionRings(rings)
{
  for (var i = 0; i < rings.length; i++) {
    for (var j = i+1; j < rings.length; j++) {
      if (i == j) {
        continue;
      }
      var test = utils.outerHulls(ghClipping(rings[i], rings[j], false, false));

      // If the length is 1, we joined the two areas, so replace
      // rings[i] with the new shape, and remove rings[j]
      // Then reset the j iterator so we can make sure that none of
      // the previous rings will now overlap the new rings[i]
      if (test.length == 1) {
        rings[i] = test[0];
        rings.splice(j, 1);
        j = i;
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
  if (typeof coords2 != 'undefined' && coords2 != null) {
    // TODO: make this more robust. This will fail in some cases
    if (!utils.isMultiPolygon(coords)) {
      coords = [coords];
    }
    if (!utils.isMultiPolygon(coords2)) {
      coords2 = [coords2];
    }
    coords = coords.concat(coords2)
  }


  coords = utils.clone(coords);
  var hulls = utils.outerHulls(coords);
  var holes = utils.holes(coords);

  // Union all hulls
  hulls = utils.wrapToPolygons(unionRings(hulls));

  // Union all holes - If holes overlap, they should be joined
  if (holes.length > 0) {
    holes = unionRings(holes);
    console.log(holes);
    holes = utils.wrapToPolygons(holes);
    // Subtract all rings from the unioned set
    return subtract(hulls, holes);
  }

  return hulls;
}
