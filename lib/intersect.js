var ghClipping = require('./greiner-hormann');
var union = require('./union');
var utils = require('./util');
var subtract = require('./subtract');

module.exports = function (subject, clipper) {
  subject = utils.clone(subject);
  clipper = utils.clone(clipper);
  var sHulls = utils.outerHulls(subject);
  var cHulls = utils.outerHulls(clipper);
  var holes = utils.holes(subject).concat(utils.holes(clipper));
  var result = [];

  for (var i = 0; i < sHulls.length; i++) {
    for (var j = 0; j < cHulls.length; j++) {
      var test = ghClipping(sHulls[i], cHulls[j], true, true);
      if (Array.isArray(test)) {
        result = result.concat(test);
      }
    }
  }

  // Union all the holes then subtract them rom the result
  if (holes.length > 0) {
    var holeUnion = union(utils.wrapToPolygons(holes));
    return subtract(result, utils.wrapToPolygons(utils.outerHulls(holeUnion)));
  }

  return result;
};
