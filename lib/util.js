if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

Ring = require('./ring');


/**
 * Takes a of structured polygons and returns only the outer hulls
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.outerHulls = function(collection) {
  return collection.map(function (elem) {
    return elem.hull;
  });
};

/**
 * Takes a list of structured polygons and returns only the holes
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.holes = function(collection) {
  var holes = [];
  collection.forEach(function (elem) {
    holes = holes.concat(elem.holes);
  });
  return holes;
};


/**
 * Converts a collection of structured polygons which have
 * plain coordinate arrays as their hull/holes into structured
 * polygons with Rings representing their hull/holes
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.asRings = function (collection) {
  return collection.map(function (elem) {
    elem.hull = Ring.fromArray(elem.hull);
    elem.holes = elem.holes.map(function (hole) {
      return Ring.fromArray(hole);
    });
    return elem;
  });
}


exports.pointsEqual = function (pt1, pt2) {
  if (pt1[0] == pt2[0] && pt1[1] == pt2[1]) {
    return true;
  }
  return false;
}

/**
 * Converts geojson-style ring arrays into the GH
 * internal structure
 *
 *
 * @param  {[type]} gj [description]
 * @return {[type]}    [description]
 */
exports.coordsToStructured = function(collection) {
  var result = [];

  var test = function(elem) {
    if (elem.hasOwnProperty("hull") && elem.hasOwnProperty("holes")) {
      result.push(elem);
      return true;
    }

    if (elem && elem[0] && elem[0][0] && !Array.isArray(elem[0][0][0])) {
      var structured = { hull: elem[0].slice(), holes:[]};

      for (var i = 1; i < elem.length; i++) {
        structured.holes.push(elem[i].slice());
      }
      result.push(structured);
      return true;
    }
    return false;
  };

  var iterate = function(c) {
    if (!Array.isArray(c) || test(c)) {
      return;
    }

    c.forEach(function(elem) {
      if (!test(elem)) {
        iterate(elem);
      }
    });
  }

  iterate(collection);

  return result;
};
