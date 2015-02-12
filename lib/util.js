if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

// deep clone an array of coordinates / polygons
exports.clone = function(array) {
  var new_arr = [];
  for (var i = 0; i < array.length; i++) {
    if (Array.isArray(array[i])){
      new_arr.push(exports.clone(array[i]).slice());
    } else {
      new_arr.push(array[i]);
    }
  }
  return new_arr;
}

// Wrap an array of geometries to an array of polygons
exports.wrapToPolygons = function(array) {
  var wrapped = [];
  for(var i = 0; i < array.length; i++) {
    if (exports.isRing(array[i])) {
      wrapped.push([array[i]]);
    } else if (exports.isMultiPolygon(array[i])) {
      wrapped.concat(array[i]);
    } else if (exports.isPolygon(array[i])) {
      wrapped.push(array[i]);
    }
  }
  return wrapped;
}

// Unwrap polygons to an array of rings
exports.unwrap = function(array) {
  var unwrapped = [];
  for (var i = 0; i < array.length; i++) {
    for (var j = 0; j < array[i].length; j++) {
      unwrapped.push(array[i][j]);
    }
  }
}


/**
 * Count array depth (used to check for geom type)
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.depth = function(collection) {
  function depth(collection, num) {
    if (Array.isArray(collection)) {
      return depth(collection[0], num+1);
    }
    return num;
  }

  return depth(collection, 0);
}


exports.isMultiPolygon = function(poly) {
  if (exports.depth(poly) == 4) {
    return true;
  }
  return false;
}


exports.isPolygon = function(poly) {
  if (exports.depth(poly) == 3) {
    return true;
  }
  return false;
}

exports.isRing = function(poly) {
  if(exports.depth(poly) == 2) {
    return true;
  }
  return false;
}

/**
 * Takes a list of polygons / multipolygons and returns only the outer hulls
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.outerHulls = function(collection) {
  var hulls = [];

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
}

/**
 * Takes a list of multipolygons / polygons and returns only the holes
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.holes = function(collection) {
  var holes = [];

  for (var i = 0; i < collection.length; i++) {
    if (exports.isMultiPolygon(collection[i])) {
      // Each polygon
      for (var j = 0; j < collection[i].length; j++) {
        for (var k = 1; k < collection[i][j].length; k++) {
          holes.push(collection[i][j][k]);
        }
      }
    } else if (exports.isPolygon(collection[i])) {
      for (var j = 1; j < collection[i].length; j++) {
        holes.push(collection[i][j]);
      }
    }
  }

  return holes;
}
