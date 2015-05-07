var ghClipping = require('./greiner-hormann');
var utils = require('./util');
var subtract = require('./subtract');

/**
 * Iteratively join all rings in the passed set.
 *
 * @param  {array} rings An array of polygon rings
 * @return {[type]}       [description]
 */
function unionRings(rings, holes)
{
  var step = 0;
  for (var i = 0; i < rings.length; i++) {
    for (var j = i+1; j < rings.length; j++) {
      if (i == j) {
        continue;
      }
      var test = ghClipping(rings[i], rings[j], false, false);

      // If the length is 1, we joined the two areas, so replace
      // rings[i] with the new shape, and remove rings[j]
      // Then reset the j iterator so we can make sure that none of
      // the previous rings will now overlap the new rings[i]
      if (test.length == 1) {
        rings[i] = test[0][0];
        rings.splice(j, 1);
        j = i;

        // If there are holes, copy them into the holes array.
        if (test[0].length > 1) {
          test[0].forEach(function(elem, idx) {
            if (idx != 0) {
              holes.push(elem);
            }
          });
        }
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
  // Preprocess the holes. This covers cases such as the one here:
  // https://github.com/tchannel/greiner-hormann/issues/7
  for (var i = 0; i < coords.length; i++) {
    for (var j = i+1; j < coords.length; j++) {
      var jhulls = utils.outerHulls(coords[j]);
      var iholes = utils.holes(coords[i]);

      if (iholes.length > 0) {
        var newholes = subtract(utils.wrapToPolygons(iholes), jhulls);
        coords[i].splice(1);
        coords[i] = coords[i].concat(utils.outerHulls(newholes));
      }
    }
  }




  var hulls = utils.outerHulls(coords);
  var holes = utils.holes(coords);

  // Union all hulls. Holes is passed in, to handle cases where the union
  // generates new holes (they'll be pushed into the holes array)
  hulls = utils.wrapToPolygons(unionRings(hulls, holes));

  // Union all holes - If holes overlap, they should be joined
  if (holes.length > 0) {
    holes = unionRings(holes);
    holes = utils.wrapToPolygons(holes);
    // Subtract all rings from the unioned set
    return subtract(hulls, holes);
  }

  return hulls;
}
