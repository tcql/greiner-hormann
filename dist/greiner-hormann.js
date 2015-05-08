(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ghClipping = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = {
  union: require('./lib/union'),
  intersect: require('./lib/intersect'),
  subtract: require('./lib/subtract'),

  // include utils to make things easier
  utils: require('./lib/util')
};

},{"./lib/intersect":3,"./lib/subtract":5,"./lib/union":6,"./lib/util":7}],2:[function(require,module,exports){
var Ring = require('./ring');
var Vertex = require('./vertex');
var pip = require('point-in-polygon');
var util = require('./util');

/**
 * Greiner-Hormann clipping uses 3 phases:
 *
 * 1. Find intersection vertices, build data structure
 * 2. Mark vertices as entry/exit points
 * 3. Build Polygons
 *
 * We additionally add in some special case handling
 * after intersection detection, because GH won't handle
 * cases where one of the polygons fully encloses the other,
 * or the two polygons are totally disjoint
 */
module.exports = function(subject, clipper, s_forward, c_forward) {
  s_forward = !!s_forward;
  c_forward = !!c_forward;

  var mode = detectMode(s_forward, c_forward);
  var sPoints = Ring.fromArray(subject);
  var cPoints = Ring.fromArray(clipper);


  /**
   * PHASE ONE: Identify Intersections
   */
  var vertices = buildIntersectionLists(sPoints, cPoints, subject, clipper);
  markDegensAsIntersect(sPoints);

  /**
   * OPTIMIZATION / EDGE CASES: check for known cases where we can bail out early
   */
  var maybeResult;
  if (maybeResult = checkQuitCases(sPoints, cPoints, subject, clipper, mode)) {
    return maybeResult;
  }

  /**
   * PHASE TWO: Identify Entry/Exit (Includes Degeneracy labelling logic)
   */
  setEntryExit(sPoints);

  /**
   * PHASE THREE: Build clipped polys
   */
  res = buildPolygons(sPoints, s_forward, c_forward);

  if(!res || res.length == 0) {
    logPoints(sPoints, cPoints);
  }
return res;
}

/**
 * s_forward and c_forward can be manipulated to change the operation
 * applied to the subject / clipper. This method provides a string
 * representation of the mode for easy reference.
 *
 *  Operation        | s_forward   | c_forward
 * -----------------------------------------------
 *  Union            | false       | false
 *  Intersect        | true        | true
 *  Subtract (A - B) | false       | true
 *  Subtract (B - A) | true        | false
 *
 * @param  {bool} s_forward whether to traverse the subject polygon in forward order
 * @param  {bool} c_forward whether to traverse the clip polygon in forward order
 * @return {string}           the string description of the selected clip mode
 */
function detectMode(s_forward, c_forward) {
  if (!s_forward && !c_forward) {
    mode = 'union';
  } else if (s_forward && c_forward) {
    mode = 'intersect';
  } else if (!s_forward && c_forward) {
    mode = 'subtractB'; // A - B
  } else if (s_forward && !c_forward) {
    mode = 'subtractA'; // B - A
  }
  return mode;
}

/**
 * Handles some cases here we can bail out without fully computing the intersection.
 *
 * @return {array|null} the result polygons, if an edge case was handled
 */
function checkQuitCases(sPoints, cPoints, subject, clipper, mode) {
  var totalS = sPoints.count();
  var totalC = cPoints.count();

  // No intersections exist
  if (sPoints.count('intersect', true) === 0) {
    switch (mode) {
      case "union":
        // Return both shapes as a multipolygon
        return [[subject], [clipper]];
        break;
      case "intersect":
        // There's no intersection, return nothing.
        return [];
        break;
      case "subtractB":
        // If B is inside of A, it's a hole.
        if (cPoints.first.type == "in") {
          return [[subject, clipper]];
        }
        if (sPoints.count('type', 'in') == totalS) {
          return [];
        }

        // Otherwise it's disjoint, so we ignore it.
        return [[subject]]
        break;
      case "subtractA":
        // If A is inside of B, it's a hole.
        if (sPoints.first.type == "in") {
          return [[clipper, subject]];
        }
        if (cPoints.first.type == "in") {
          return [];
        }
        // Otherwise it's disjoint, so we ignore it.
        return [[clipper]];
        break;
    }
  }

  // All points are degenerate. The shapes may be spatially equal.
  // The intersect === 1 is a dumb hack for certain cases where (probably because of
  // floating point errors) a single point of a polygon we generated is touching
  // an edge. This is probably a sign of a bigger issue in intersection detection,
  // but we'll wait and see how that goes
  if (totalS == sPoints.count('degenerate', true) || sPoints.count("intersect", true) == 1) {
    switch (mode) {
      case "subtractA":
        // If all points in the clip are also degenerate, these shapes
        // are equal.
        if (totalC == cPoints.count('degenerate', true)) {
          return [];
        }
        return [[clipper]];
        break;
      case "subtractB":
        // If all points in the clip are also degenerate, these shapes
        // are equal.
        if (totalC == cPoints.count('degenerate', true)) {
          return [];
        }
        return [[subject]];
        break;
      default:
        return [[subject]];
    }
  }
}


/**
 * Builds the list of Polygon(s) representing the desired overlap of
 * the subject/clipper.
 *
 * @param  {[type]} sPoints [description]
 * @return {[type]}         [description]
 */
function buildPolygons(sPoints, s_forward, c_forward) {
  var curr = sPoints.first;
  var polylist = [];
  var onclip = false;
  var endir = 'next';
  var exdir = 'prev';

  while (curr = sPoints.firstIntersect()) {
    var poly = [[curr.x, curr.y]];

    do {
      if (onclip) {
        endir = c_forward ? 'next' : 'prev';
        exdir = c_forward ? 'prev' : 'next';
      } else {
        endir = s_forward ? 'next' : 'prev';
        exdir = s_forward ? 'prev' : 'next';
      }

      curr.checked = true;
      if (curr.neighbor) {
        curr.neighbor.checked = true;
      }

      if (curr.entry) {
        do {
            curr = curr[endir];
            poly.push([curr.x, curr.y]);
        } while (!curr.intersect);
      } else {
        do {
          curr = curr[exdir];
          poly.push([curr.x, curr.y]);
        } while (!curr.intersect);
      }

      // Jump to the other list
      curr = curr.neighbor;
      onclip = !onclip;

    } while (!curr.checked);

    if (!util.pointsEqual(poly[0], poly[poly.length - 1])) {
      poly.push(poly[0]);
    } else if (poly.length < 4) {
      continue;
    }
    polylist.push({geom: poly, is_hole: false})
  }

  // Generate a graph of which polygons own which other polygons (detect holes)
  var result = [];
  var graph = {};
  for (var i = 0; i < polylist.length; i++) {
    if (!graph[i]) { graph[i] = []; }

    for (var j = i+1; j < polylist.length; j++) {
      // Because we just generated the intersections, we know that
      // none of these results can intersect eachother, so we only need to
      // run PIP on a single point of each poly.
      if (pip(polylist[j].geom[0], polylist[i].geom)) {
        polylist[j].is_hole = true;
        graph[i].push(j);
      }
    }
  }

  // Construct polys with their holes
  for (var key in graph) {
    if (polylist[key].is_hole) {
      continue;
    }
    var poly = [polylist[key].geom];
    graph[key].forEach(function (idx) {
      poly.push(polylist[idx].geom);
    });
    result.push(poly);
  }
  return result;
}

/**
 * Builds vertex lists for the subject and clipper. Essentially
 * the way this will work is that it will detect intersections by
 * comparing each pair of lines between the subject / clipper, then
 * injecting intersection vertices (marked by the "intersects" property)
 * in the appropriate spots in each coordinate list.
 *
 * Once this is complete, our subject and clipper coordinate lists will
 * each contain, in traversable order, every vertex, including ones for
 * each point where the other polygon intersected.
 *
 * @param  {[type]} sPoints [description]
 * @param  {[type]} cPoints [description]
 * @return {[type]}         [description]
 */
function buildIntersectionLists(sPoints, cPoints, sPoly, cPoly) {
  var sCurr = sPoints.first;

  do {
    setPointRelativeLocation(sCurr, cPoly)
    var cCurr = cPoints.first;
    if (!sCurr.intersect) {
      do {
        setPointRelativeLocation(cCurr, sPoly)
        if (!cCurr.intersect) {
          var sEnd = sPoints.nextNonIntersect(sCurr.next);
          var cEnd = cPoints.nextNonIntersect(cCurr.next);
          var intersect = lineIntersects(sCurr, sEnd, cCurr, cEnd);

          if (intersect) {
            cCurr = handleIntersection(sPoints, cPoints, sCurr, sEnd, cCurr, cEnd, intersect);
          }
        }

        cCurr = cCurr.next;
      } while (cCurr !== cPoints.first);
    }

    sCurr = sCurr.next;
  } while (sCurr !== sPoints.first);
}

/**
 * Loop back through, ensuring that all degenerate vertices
 * are marked as intersections.
 *
 * @param  {Ring} points [description]
 * @return {[type]}        [description]
 */
function markDegensAsIntersect(points) {
  var curr = points.first;

  do {
    if (curr.degenerate) {
      curr.intersect = true;
      curr.neighbor.intersect = true;
    }
    curr = curr.next
  } while (curr != points.first)
}

/**
 * Handle inserting / replacing points appropriately for
 * a found intersection
 *
 * @param  {Ring}   sPoints   Subject Ring
 * @param  {Ring}   cPoints   Clip Ring
 * @param  {Vertex} sCurr     Start of the Subject line
 * @param  {Vertex} sEnd      End of the Subject line
 * @param  {Vertex} cCurr     Start of the Clip line
 * @param  {Vertex} cEnd      End of the Clip line
 * @param  {Object} intersect Object representing an intersection
 * @return {[type]}           [description]
 */
function handleIntersection(sPoints, cPoints, sCurr, sEnd, cCurr, cEnd, intersect) {
  var sPt, cPt;
  var s_between = 0 < intersect.alphaA && intersect.alphaA < 1;
  var c_between = 0 < intersect.alphaB && intersect.alphaB < 1;

  if (s_between && c_between) {
    sPt = new Vertex(intersect.x, intersect.y, intersect.alphaA, true);
    cPt = new Vertex(intersect.x, intersect.y, intersect.alphaB, true);
    sPoints.insert(sPt, sCurr, sEnd);
    cPoints.insert(cPt, cCurr, cEnd);
  } else {
    // Handle various degeneracy cases for the subject point
    if (s_between) {
      sPt = new Vertex(intersect.x, intersect.y, intersect.alphaA, true, true);
      sPoints.insert(sPt, sCurr, sPoints.nextNonIntersect(sCurr.next));
    } else if (intersect.alphaA == 0) {
      sCurr.intersect = true;
      sCurr.degenerate = true;
      sCurr.alpha = intersect.alphaA;
      sPt = sCurr;
    } else if (intersect.alphaA == 1) {
      // End points get marked as degenerate but don't get marked as intersects.
      // This allows us to catch them later, and still use them for generating
      // lines to test against the other polygon
      sEnd.intersect = false;
      sEnd.degenerate = true;
      sEnd.alpha = intersect.alphaA;
      sPt = sEnd;
    }

    // Handle various degeneracy cases for the clip point
    if (c_between) {
      cPt = new Vertex(intersect.x, intersect.y, intersect.alphaB, true, true);
      cPoints.insert(cPt, cCurr, cPoints.nextNonIntersect(cCurr.next));
    } else if (intersect.alphaB == 0) {
      cCurr.intersect = true;
      cCurr.degenerate = true;
      cCurr.alpha = intersect.alphaB;
      cPt = cCurr;
    } else if (intersect.alphaB == 1) {
      // End points get marked as degenerate but don't get marked as intersects.
      // This allows us to catch them later, and still use them for generating
      // lines to test against the other polygon
      cEnd.intersect = false;
      cEnd.degenerate = true;
      cEnd.alpha = intersect.alphaB;
      cPt = cEnd;
      if (cCurr.next != cPoints.first) {
        cCurr = cCurr.next;
      }
    }
  }

  // Neighbors are used to jump back and forth between the lists
  if (sPt && cPt) {
    sPt.neighbor = cPt;
    cPt.neighbor = sPt;
    // Intersections are always "on" a line
    sPt.type = "on";
    cPt.type = "on";
  }
  return cCurr;
}

/**
 * Set a point in or out compared to the other polygon:
 * - if it's a subject point, compare to the clip polygon,
 * - if it's a clip point, compare to the subject polygon
 *
 * @param {Vertex}  pt   Point to check against the poly
 * @param {Polygon} poly Check if pt is within this poly
 */
function setPointRelativeLocation(pt, poly) {
  if (!pt.type) {
    if (pip([pt.x, pt.y], poly)) {
      pt.type = "in";
    } else {
      pt.type = "out";
    }
  }
}

/**
 * Handle setting entry/exit flags for each intersection. This is
 * where a large part of degeneracy handling happens - the original
 * GH algorithm uses very simple entry/exit handling, which won't work
 * for our degenerate cases.
 *
 * http://arxiv-web3.library.cornell.edu/pdf/1211.3376v1.pdf
 *
 * @param {Ring}    sPoints The subject polygon's vertices
 */
function setEntryExit(sPoints) {
  var first = sPoints.first;
  var curr = first;

  do {
    if (curr.intersect && curr.neighbor) {
      handleEnEx(curr);
      handleEnEx(curr.neighbor);

      // If this and the neighbor share the same entry / exit flag values
      // we need to throw them out and relabel
      switch (curr.entryPair()) {
        case "en/en":
          curr.remove = true;
          curr.type = "in";
          curr.intersect = false;
          curr.neighbor.intersect = false;
          break;
        case "ex/ex":
          curr.remove = true;
          curr.type = "out";
          curr.intersect = false;
          curr.neighbor.intersect = false;
          break;
      }
    }

    curr = curr.next;
  } while (curr != first)
}

/**
 * Handles deciding the entry / exit flag setting for a given point.
 * This is probably where most of the things could be wrong
 *
 * @param  {Vertex} curr The vertex to flag
 */
function handleEnEx(curr) {
  var cp = curr.pairing();
  switch (cp) {
      case "in/out":
      case "on/out":
      case "in/on":
        curr.entry = false;
        break;
      case "out/in":
      case "on/in":
      case "out/on":
        curr.entry = true;
        break;
      case "out/out":
      case "in/in":
      case "on/on":
        var np = curr.neighbor.pairing();
        if (np == "out/out" || np == "in/in" || np == "on/on" || (cp == "on/on" && np == "on/out")) {
          curr.remove = true;
          curr.neighbor.remove = true;
          curr.neighbor.intersect = false;
          curr.intersect = false;
        } else {
          handleEnEx(curr.neighbor);
          curr.entry = !curr.neighbor.entry;
        }
        break;
      default:
        // This shouldn't ever happen - It's here to confirm nothing stupid is happening.
        console.error("UNKNOWN TYPE", curr.pairing())
    }
}


/**
 * Take two lines (each represented by the respective
 * start and end), and tells you where they intersect,
 * as well as the intersection alphas
 *
 * @param  {Vertex} start1 [description]
 * @param  {Vertex} end1   [description]
 * @param  {Vertex} start2 [description]
 * @param  {Vertex} end2   [description]
 * @return {[type]}        [description]
 */
function lineIntersects(start1, end1, start2, end2) {
  // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
  var denominator, a, b, numerator1, numerator2, result = {
    x: null,
    y: null,
    onLine1: false,
    onLine2: false,
    alphaA: null,
    alphaB: null,
  };
  denominator = ((end2.y - start2.y) * (end1.x - start1.x)) - ((end2.x - start2.x) * (end1.y - start1.y));
  if (denominator == 0) {
    if (start1.equals(start2)) {
      result.x = start1.x
      result.y = start1.y
      result.alphaA = 0;
      result.alphaB = 0;
      return result;
    }
    return false;
  }

  a = start1.y - start2.y;
  b = start1.x - start2.x;
  numerator1 = ((end2.x - start2.x) * a) - ((end2.y - start2.y) * b);
  numerator2 = ((end1.x - start1.x) * a) - ((end1.y - start1.y) * b);
  a = numerator1 / denominator;
  b = numerator2 / denominator;

  // if we cast these lines infinitely in both directions, they intersect here:
  result.x = start1.x + (a * (end1.x - start1.x));
  result.y = start1.y + (a * (end1.y - start1.y));
  result.alphaA = a;
  result.alphaB = b;

  // TODO: any better way to handle this?
  if (result.alphaA > 0.99999999999999) {
    result.alphaA = 1;
  }
  if (result.alphaB > 0.99999999999999) {
    result.alphaB = 1;
  }
  if (result.alphaA < 0.00000000000001) {
    result.alphaA = 0;
  }
  if (result.alphaB < 0.00000000000001) {
    result.alphaB = 0;
  }

  // if line1 is a segment and line2 is infinite, they intersect if:
  if (0 <= a && a <= 1) {
    result.onLine1 = true;
  }
  // if line2 is a segment and line1 is infinite, they intersect if:
  if (0 <= b && b <= 1) {
    result.onLine2 = true;
  }
  // if line1 and line2 are segments, they intersect if both of the above are true
  if(result.onLine1 && result.onLine2){
    return result;
  }
  else {
    return false;
  }
}


/**
 * Utility method for logging points
 *
 * @param  {[type]} sPoints [description]
 * @param  {[type]} cPoints [description]
 * @return {[type]}         [description]
 */
function logPoints(sPoints, cPoints) {
  console.log("POINTS")
  console.log("-----------------")
  var curr = sPoints.first
  do {
    curr.log();
    curr = curr.next
  } while (curr != sPoints.first)
  console.log("-----------------")
  if (!cPoints) return;
  var curr = cPoints.first
  do {
    curr.log();
    curr = curr.next
  } while (curr != cPoints.first)
}

/**
 * Utility method for logging intersecions and degenerate points
 *
 * @param  {[type]} sPoints [description]
 * @return {[type]}         [description]
 */
function logIntersections(sPoints) {
  console.log("-------------------")
  console.log("INTERSECTION LIST: ")
  console.log("-------------------")
  var curr = sPoints.first
  do {
    if (curr.intersect || curr.degenerate) {
      curr.log()
    }
    curr = curr.next
  } while (curr != sPoints.first)
  console.log("")
}



},{"./ring":4,"./util":7,"./vertex":8,"point-in-polygon":9}],3:[function(require,module,exports){
var ghClipping = require('./greiner-hormann');
var union = require('./union');
var utils = require('./util');
var subtract = require('./subtract');

module.exports = function(subject, clipper) {
  var subject = utils.clone(subject);
  var clipper = utils.clone(clipper);
  var s_hulls = utils.outerHulls(subject);
  var c_hulls = utils.outerHulls(clipper);
  var holes = utils.holes(subject).concat(utils.holes(clipper));
  var result = [];

  for (var i = 0; i < s_hulls.length; i++) {
    for (var j = 0; j < c_hulls.length; j++) {
      var test = ghClipping(s_hulls[i], c_hulls[j], true, true);
      if (Array.isArray(test)) {
        result = result.concat(test);
      }
    }
  }

  // Union all the holes then subtract them rom the result
  if (holes.length > 0) {
    var holeUnion = union(holes);

    return subtract(result, utils.outerHulls(holeUnion));
  }

  return result;
}

},{"./greiner-hormann":2,"./subtract":5,"./union":6,"./util":7}],4:[function(require,module,exports){
var Vertex = require('./vertex');
var clockwise = require('turf-is-clockwise');

/**
 * Ring is a circular doubly-linked list; Every node
 * has a next and a prev, even if it's the only node in the list.
 *
 * This supports some search methods that need to wrap back to the start of the list.
 */
function Ring () {
    this.first = null;
}

Ring.prototype.count = function(countkey, countval) {
    var curr = this.first;
    var count = 0;
    while (true) {
        if (countkey) {
            if (curr[countkey] === countval) {
                count++;
            }
        } else {
            count++;
        }
        curr = curr.next;

        if (curr == this.first) {
            break;
        }
    }
    return count;
}


/**
 * Takes an array of coordinates and constructs a Ring
 *
 * @param  {array} coordinates   the array of coordinates to convert to a Ring
 * @return {Ring}
 */
Ring.fromArray = function(coordinates) {
    var ring = new Ring()

    if (!clockwise(coordinates)) {
        coordinates = coordinates.reverse();
    }

    for (var i = 0; i < (coordinates.length - 1); i++) {
        var elem = coordinates[i];
        ring.push(new Vertex(elem[0], elem[1]));
    }

    return ring;
}

/**
 * Push a vertex into the ring's list. This
 * just updates pointers to put the point at
 * the end of the list
 *
 * @param  {Vertex} vertex the vertex to push
 */
Ring.prototype.push = function(vertex) {
    if (!this.first) {
        this.first = vertex;
        this.first.prev = vertex;
        this.first.next = vertex;
    } else {
        next = this.first;
        prev = next.prev;
        next.prev = vertex;
        vertex.next = next;
        vertex.prev = prev;
        prev.next = vertex;
    }
}

/**
 * Insert a vertex between specific vertices
 *
 * If there are intersection points, inbetween
 * start and end, the new vertex is inserted
 * based on it's alpha value
 *
 * @param  {Vertex} vertex the vertex to insert
 * @param  {Vertex} start  the "leftmost" vertex this point could be inserted next to
 * @param  {Vertex} end    the "rightmost" vertex this could could be inserted next to
 */
Ring.prototype.insert = function(vertex, start, end) {
    var curr = start.next;

    while (curr != end && curr.alpha < vertex.alpha) {
        curr = curr.next;
    }

    // Insert just before the "curr" value
    vertex.next = curr;
    prev = curr.prev;
    vertex.prev = prev;
    prev.next = vertex;
    curr.prev = vertex;
}

/**
 * Start at the start vertex, and get the next
 * point that isn't an intersection
 *
 * @param  {Vertex} start the vertex to start searching at
 * @return {Vertex} the next non-intersect
 */
Ring.prototype.nextNonIntersect = function (start) {
    var curr = start;
    while (curr.intersect && curr != this.first) {
        curr = curr.next
    }
    return curr;
}

/**
 * Returns the first unchecked intersection in the list
 *
 * @return {Vertex|bool}
 */
Ring.prototype.firstIntersect = function () {
    var curr =  this.first;

    while (true) {
        if (curr.intersect && !curr.checked) {
            return curr;
        }

        curr = curr.next;

        if (curr == this.first) {
            break;
        }
    }
    return false;
}

/**
 * Converts the Ring into an array
 *
 * @return {array} array representation of the ring
 */
Ring.prototype.toArray = function () {
    var curr = this.first;
    var points = [];

    do {
        points.push([curr.x, curr.y]);
        curr = curr.next;
    } while (curr != this.first);

    return points;
}

module.exports = Ring;

},{"./vertex":8,"turf-is-clockwise":10}],5:[function(require,module,exports){
var util = require('./util');
var ghClipping = require('./greiner-hormann');

function intersect(hulls, holes) {
  var result = [];
  for (var i = 0; i < hulls.length; i++) {
    for (var j = 0; j < holes.length; j++) {
      var test = ghClipping(hulls[i], holes[j], true, true);
      if (Array.isArray(test)) {
        result = result.concat(test);
      }
    }
  }
  return result;1
}

function subtract(subject, clip, skiploop) {
  skiploop = !!skiploop;
  subject = util.clone(subject);
  clip = util.clone(clip);

  var s_hulls = util.outerHulls(subject);
  var c_hulls = util.outerHulls(clip);
  var c_holes = util.holes(clip);

  // TODO:
  // If there are any holes in the subject, subtract those as well
  // If there are any holes in the clip, which overlap the original
  // subject, these should be unioned in. This means we'll have to
  // check polygon within-ness for each clip hole

  // first intersect any holes in clip against the hulls in the subject.
  // If there are results from these, then these holes overlap the subject,
  // meaning they (or some part of them) will be saved in the final output as
  // outer hulls
  if (c_holes) {
    var c_holes = intersect(s_hulls, c_holes);
  }

  if (util.isPolygon(subject)) {
    subject = [subject];
  } else {
    subject = util.wrapToPolygons(subject);
  }

  for (var i = 0; i < c_hulls.length; i++) {
    var ilen = subject.length;
    for (var j = 0; j < subject.length; j++) {
      var test = ghClipping(subject[j][0], c_hulls[i], false, true);
      if (test.length == 0) {
        subject.splice(j, 1);
        j--;
        continue;
      }
      // Copy the primary hull of the intersect record that
      // we just clipped against the hull
      subject[j][0] = test[0][0];

      // Copy in each hole (if there were any) for the primary hull
      for (var k = 1; k < test[0].length; k++) {
        subject[j].push(test[0][k]);
      }

      // If there are any additional polygons in the result,
      // they were newly created by intersecting this hole.
      // Push the new polygon (hull and any holes) straight
      // into the intersect list
      for (var k = 1; k < test.length; k++) {
        subject.push(test[k]);
      }
    }

    // If the length has changed, this hole created
    // new intersection polygons, which means it's not a hole
    // anymore (it crossed the polys, now it's boundary is
    // part of the new intersection hulls). Therefore, we
    // remove this hole from the list so it won't be returned.
    if (ilen != subject.length) {
      c_hulls.splice(i, 1)
      i--;
    }
  }

  // Union remaining clip-polygon holes if they exist.
  if (c_holes.length > 0) {
    subject = subject.concat(util.wrapToPolygons(c_holes));
  }

  // Re-cut everything against the subject's holes to be
  // 100% certain they don't change any information in the output
  var s_holes = util.holes(subject);

  if (s_holes.length > 0 && !skiploop) {
    return subtract(util.wrapToPolygons(util.outerHulls(subject)), util.wrapToPolygons(s_holes), true)
  }

  return subject;
}


module.exports = subtract;

},{"./greiner-hormann":2,"./util":7}],6:[function(require,module,exports){
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
function clipHoles(coords, hull_idx, hole_idx) {
  var hulls = utils.outerHulls(coords[hull_idx]);
  var holes = utils.holes(coords[hole_idx]);

  if (holes.length > 0) {
    var newholes = subtract(utils.wrapToPolygons(holes), hulls);
    coords[hole_idx].splice(1);
    coords[hole_idx] = coords[hole_idx].concat(utils.outerHulls(newholes));
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
      clipHoles(coords, j, i);
      clipHoles(coords, i, j);
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

},{"./greiner-hormann":2,"./subtract":5,"./util":7}],7:[function(require,module,exports){
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
}

/**
 * Takes a list of multipolygons / polygons and returns only the holes
 *
 * @param  {[type]} collection [description]
 * @return {[type]}            [description]
 */
exports.holes = function(collection) {
  var holes = [];

  if (exports.isPolygon(collection)) {
    return collection.slice(1)
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
      for (var j = 1; j < collection[i].length; j++) {
        holes.push(collection[i][j]);
      }
    }
  }

  return holes;
}


exports.pointsEqual = function (pt1, pt2) {
  if (pt1[0] == pt2[0] && pt1[1] == pt2[1]) {
    return true;
  }
  return false;
}

},{}],8:[function(require,module,exports){
function Vertex (x, y, alpha, intersect, degenerate) {
    this.x = x;
    this.y = y;
    this.alpha = alpha || 0.0;
    this.intersect = intersect || false;
    this.entry = true; // Set to true by default, for degeneracy handling
    this.checked = false;
    this.degenerate = degenerate || false;
    this.neighbor = null;
    this.next = null;
    this.prev = null;
    this.type = null; // can be "in", "out", "on"
    this.remove = false;
}

/**
 * Returns a string representing the types of the previous and next vertices.
 * For example, if the prev vertex had type "in" and the next had type "out",
 * the pairing would be "in/out". This matches the way pairs are referenced in
 * the Greiner-Hormann Degeneracy paper.
 *
 * @return {String} the pairing description
 */
Vertex.prototype.pairing = function () {
    return this.prev.type + "/" + this.next.type;
}

/**
 * Returns a string representing the entry / exit flag of this vertex and it's neighbor
 * For example, if the current vertex was flagged entry = true and it's neighbor was flagged
 * entry = false, the entryPair would be "en/ex" (short for "entry/exit"). This matches the
 * way flags are referenced in the Greiner-Hormann Degeneracy paper.
 *
 * @return {String} the entry/exit pair string
 */
Vertex.prototype.entryPair = function() {
    var entry = this.entry ? "en" : "ex";
    var nEntry = this.neighbor.entry ? "en" : "ex";

    return entry+"/"+nEntry;
}

/**
 * Determine if this vertex is equal to another
 *
 * @param  {Vertex} other the vertex to compare with
 * @return {bool}   whether or not the vertices are equal
 */
Vertex.prototype.equals = function(other) {
    if (this.x == other.x && this.y == other.y) {
        return true;
    }
    return false;
};

/**
 * Utility method to log the vertex, only for debugging
 */
Vertex.prototype.log = function() {
  console.log(
      "INTERSECT: "+ (this.intersect ? "Yes" : "No ")
      +" ENTRY: "+(this.entry ? "Yes": "No ")
      +" DEGEN: "+(this.degenerate ? "Yes": "No ")
      +" TYPE: "+String(this.prev.type+" ").slice(0, 3)
          +" / "+String(this.type+" ").slice(0, 3)
          +" / "+String(this.next.type+" ").slice(0, 3)
      +" ALPHA: "+ this.alpha.toPrecision(3)
      +" REMOVE: "+ (this.remove ? "Yes": "No") + " "
      +this.x + ", "+this.y
    );
};


module.exports = Vertex;

},{}],9:[function(require,module,exports){
module.exports = function (point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    
    var x = point[0], y = point[1];
    
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
};

},{}],10:[function(require,module,exports){
module.exports = function(ring){
  var sum = 0;
  var i = 1;
  var len = ring.length;
  var prev,cur;
  while(i<len){
    prev = cur||ring[0];
    cur = ring[i];
    sum += ((cur[0]-prev[0])*(cur[1]+prev[1]));
    i++;
  }
  return sum > 0;
}
},{}]},{},[1])(1)
});


//# sourceMappingURL=greiner-hormann.js.map