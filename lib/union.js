var ghClipping = require('./greiner-hormann');
var utils = require('./util');
var subtract = require('./subtract');

/**
 * Iteratively join all rings in the passed set.
 *
 * @param  {array} rings An array of polygon rings
 * @return {[type]}       [description]
 */


/**
 * Method for subtracting hulls from holes. This is used
 * before calculating the union to ensure correctly shaped
 * holes in all of the input polygons
 *
 * @param  {[type]} coords [description]
 * @param  {[type]} j      [description]
 * @param  {[type]} i      [description]
 * @return {[type]}        [description]
 */
function clipHoles(coords, hullIdx, holeIdx) {
  var hulls = utils.outerHulls(coords[hullIdx]);
  var holes = utils.holes(coords[holeIdx]);
  if (holes.length > 0) {
    var newholes = subtract(utils.wrapToPolygons(holes), hulls);
    coords[holeIdx].splice(1);
    coords[holeIdx] = coords[holeIdx].concat(utils.outerHulls(newholes));
  }
}

// TODO: make this support polys + holes. Right now
// it takes an array of rings, not array of polys.
//
// TODO: think about the function signature here? Should it be
// traditional "union A + B", or is passing a set of things to union more useful
//
// TODO: think about using the approach here: http://blog.cleverelephant.ca/2009/01/must-faster-unions-in-postgis-14.html
// to make things faster for complex / very degenerate sets
module.exports = function (coords, coords2) {
  if (typeof coords2 !== 'undefined' && coords2 !== null) {
    // TODO: make this more robust. This will fail in some cases
    if (!utils.isMultiPolygon(coords)) {
      coords = [coords];
    }
    if (!utils.isMultiPolygon(coords2)) {
      coords2 = [coords2];
    }
    coords = coords.concat(coords2);
  }

  coords = utils.clone(coords);
  // Preprocess the holes. This covers cases such as the one here:
  // https://github.com/tchannel/greiner-hormann/issues/7
  for (var i = 0; i < coords.length; i++) {
    for (var j = i + 1; j < coords.length; j++) {
      clipHoles(coords, j, i);
      clipHoles(coords, i, j);
    }
  }

  var hulls = utils.outerHulls(coords);
  var holes = utils.holes(coords);
  // Union all hulls. Holes is passed in, to handle cases where the union
  // generates new holes (they'll be pushed into the holes array)
  hulls = utils.wrapToPolygons(utils.unionRings(hulls, holes));

  // Union all holes - If holes overlap, they should be joined
  if (holes.length > 0) {
    holes = utils.unionRings(holes);
    holes = utils.wrapToPolygons(holes);
    // Subtract all rings from the unioned set
    return subtract(hulls, holes);
  }

  return hulls;
};
