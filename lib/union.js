ghClipping = require('./greiner-hormann');
utils = require('./util');

// Todo: make this support polys + holes. Right now
// it takes an array of rings, not array of polys.
module.exports = function(coords) {
  var coords = utils.clone(coords);
  var hulls = utils.outerHulls(coords);
  var holes = utils.holes(coords);

  for (var i = 0; i < hulls.length; i++) {
    for (var j = i+1; j < hulls.length; j++) {
      if (i == j) {
        continue;
      }

      var test = utils.outerHulls(ghClipping(hulls[i], hulls[j], false, false));

      if (test.length == 1) {
        hulls[i] = test[0];
        hulls.splice(j, 1);
        j = i;
      }
    }
  }
  return hulls;
}
