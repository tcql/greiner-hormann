ghClipping = require('./greiner-hormann');
util = require('./util');

module.exports = function(coords) {
  coords = util.clone(coords);

  for (var i = 0; i < coords.length; i++) {
    for (var j = i+1; j < coords.length; j++) {
      if (coords[i] == coords[j]) {
        continue;
      }
      var test = ghClipping(coords[i], coords[j], false, false);
      if (test.length == 1) {
        coords[i] = test[0][0];
        coords.splice(j);
        j--;
      }
    }
  }
  return coords;
}
