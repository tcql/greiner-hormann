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
// to make things faster.
module.exports = function(coords) {
  var coords = utils.clone(coords);
  var hulls = utils.outerHulls(coords);
  var holes = utils.holes(coords);

  // Union all hulls
  hulls = unionRings(hulls);
  // Union all holes - If holes overlap, they should be joined
  holes = unionRings(holes);

  // Subtract all rings from the unioned set
  return subtract(hulls, holes);
}
