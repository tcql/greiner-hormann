if (!Array.isArray) {
  Array.isArray = function (arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

// deep clone an array of coordinates / polygons
exports.clone = function cloneArray(array) {
  var newArray = array.slice();

  for (var i = 0; i < newArray.length; i++) {
    if (Array.isArray(newArray[i])) {
      newArray[i] = cloneArray(newArray[i]);
    }
  }

  return newArray;
};

// Wrap an array of geometries to an array of polygons
exports.wrapToPolygons = function (array) {
  var wrapped = [];
  for (var i = 0; i < array.length; i++) {
    if (exports.isRing(array[i])) {
      wrapped.push([array[i]]);
    } else if (exports.isMultiPolygon(array[i])) {
      wrapped.concat(array[i]);
    } else if (exports.isPolygon(array[i])) {
      wrapped.push(array[i]);
    }
  }
  return wrapped;
};

// Unwrap polygons to an array of rings
exports.unwrap = function (array) {
  var unwrapped = [];
  for (var i = 0; i < array.length; i++) {
    for (var j = 0; j < array[i].length; j++) {
      unwrapped.push(array[i][j]);
    }
  }
};


/**
 * Count array depth (used to check for geom type)
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.depth = function (collection) {
  function depth(collection, num) {
    if (Array.isArray(collection)) {
      return depth(collection[0], num + 1);
    }
    return num;
  }

  return depth(collection, 0);
};


exports.isMultiPolygon = function (poly) {
  if (exports.depth(poly) === 4) {
    return true;
  }
  return false;
};


exports.isPolygon = function (poly) {
  if (exports.depth(poly) === 3) {
    return true;
  }
  return false;
};

exports.isRing = function (poly) {
  if (exports.depth(poly) === 2) {
    return true;
  }
  return false;
};

/**
 * Takes a list of polygons / multipolygons and returns only the outer hulls
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.outerHulls = function (collection) {
  var hulls = [];

  if (exports.isPolygon(collection)) {
    return [collection[0]];
  }

  for (var i = 0; i < collection.length; i++) {
    if (exports.isMultiPolygon(collection[i])) {
      // Each polygon
      for (var j = 0; j < collection[i].length; j++) {
        hulls.push(collection[i][j][0]);
      }
    } else if (exports.isPolygon(collection[i])) {
      hulls.push(collection[i][0]);
    } else if (exports.isRing(collection[i])) {
      hulls.push(collection[i]);
    }
  }

  return hulls;
};

/**
 * Takes a list of multipolygons / polygons and returns only the holes
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.holes = function (collection) {
  var holes = [];

  if (exports.isPolygon(collection)) {
    return collection.slice(1);
  }

  for (var i = 0; i < collection.length; i++) {
    if (exports.isMultiPolygon(collection[i])) {
      // Each polygon
      for (var j = 0; j < collection[i].length; j++) {
        for (var k = 1; k < collection[i][j].length; k++) {
          holes.push(collection[i][j][k]);
        }
      }
    } else if (exports.isPolygon(collection[i])) {
      for (var l = 1; l < collection[i].length; l++) {
        holes.push(collection[i][l]);
      }
    }
  }

  return holes;
};


exports.pointsEqual = function (pt1, pt2) {
  if (pt1[0] === pt2[0] && pt1[1] === pt2[1]) {
    return true;
  }
  return false;
};

/**
 * Iteratively join all rings in the passed set.
 *
 * @param  {array} rings An array of polygon rings
 * @return {[type]}       [description]
 */
exports.unionRings = function (rings, holes) {
  var ghClipping = require('./greiner-hormann');
  
  for (var i = 0; i < rings.length; i++) {
    for (var j = i + 1; j < rings.length; j++) {
      if (i === j) {
        continue;
      }
      var test = ghClipping(rings[i], rings[j], false, false);

      // If the length is 1, we joined the two areas, so replace
      // rings[i] with the new shape, and remove rings[j]
      // Then reset the j iterator so we can make sure that none of
      // the previous rings will now overlap the new rings[i]
      if (test.length === 1) {
        rings[i] = test[0][0];
        rings.splice(j, 1);
        j = i;

        // If there are holes, copy them into the holes array.
        for (var idx = 1; idx < test[0].length; idx++) {
          holes.push(test[0][idx]);
        }
      }
    }
  }
  return rings;
};
