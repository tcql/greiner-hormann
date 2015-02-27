(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.greinerHormann = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var intersect = require('./lib/intersect');
var union = require('./lib/union');
var utils = require('./lib/util');


module.exports = {
  union: union,
  intersect: intersect,

  // include utils to make things easier
  utils: utils
};

},{"./lib/intersect":3,"./lib/union":6,"./lib/util":7}],2:[function(require,module,exports){
// depend on jsts for now https://github.com/bjornharrtell/jsts/blob/master/examples/overlay.html
var turfInside = require('turf-inside');
var turfPoint = require('turf-point');
var turfPolygon = require('turf-polygon');
var Ring = require('./ring');
var Vertex = require('./vertex');
var clockwise = require('turf-is-clockwise');
var equals = new (require('geojson-equality'));

/**
 * Clips two polygons using Greiner-Hormann, with degeneracy handling
 *
 * - Greiner-Hormann: http://davis.wpi.edu/~matt/courses/clipping/
 * - Degeneracy handling: http://arxiv-web3.library.cornell.edu/pdf/1211.3376v1.pdf
 * - Python Polyclip: https://github.com/helderco/univ-polyclip
 * - ^ some Degeneracy handling: https://github.com/karimbahgat/Pure-Python-Greiner-Hormann-Polygon-Clipping/
 *
 * Some of the structure and logic is kidnapped from the python projects,
 * the remainder is derived from two papers
 */
module.exports = function(subject, clipper, s_forward, c_forward) {
  if (!clockwise(subject)) {
    subject.reverse();
  }

  if (!clockwise(clipper)) {
    clipper.reverse();
  }

  // Only build these once, since we might be checking them many times
  try {
    var sPoly = turfPolygon([subject]);
    var cPoly = turfPolygon([clipper]);
  } catch (err) {
    console.log("Clipping error: bad polygons!")
    console.log(subject)
    console.log("-------------------")
    console.log(clipper)
  }

  // These can be manipulated to change the output operation:
  //
  //  Operation        | s_forward   | c_forward
  // -----------------------------------------------
  //  Union            | false       | false
  //  Intersect        | true        | true
  //  Subtract (A - B) | false       | true
  //  Subtract (B - A) | true        | false
  //
  s_forward = s_forward === false ? false : true;
  c_forward = c_forward === false ? false : true;

  // Greiner-Hormann clipping uses 3 phases:
  //  1. Find intersection vertices, build data structure
  //  2. Mark vertices as entry/exit points
  //  3. Build Polygons
  //
  //  We additionally add in some special case handling
  //  at the end, because GH won't handle cases where
  //  one of the polygons fully encloses the other, or
  //  the two polygons are totally disjoint
  var sPoints = Ring.fromCoords(subject);
  var cPoints = Ring.fromCoords(clipper);

  /**
   * PHASE ONE: Identify Intersections
   */
  var vertices = buildIntersectionLists(sPoints, cPoints, sPoly, cPoly);
  markDegensAsIntersect(sPoints);

  /**
   * PHASE TWO: Identify Entry/Exit
   */
  setEntryExit(sPoints, cPoints, s_forward, c_forward, sPoly, cPoly);


  /**
   * PHASE THREE: Build clipped polys
   */
  var list = buildPolygons(sPoints);

  /**
   * Additional Phase: handle special cases (there were no intersections at all)
   */
  return processPolygons(list, subject, clipper, sPoly, cPoly, s_forward, c_forward);
}

/**
 * Handles special cases depending on the clipping type.
 * As noted earlier, the s_forward and c_forward arguments
 * can be used to derive what the clipping operation is
 *
 * @param  {[type]} list      List of clipped polygons
 * @param  {[type]} subject   The subject coordinate list
 * @param  {[type]} clipper   The clipper coordinate list
 * @param  {[type]} sPoly     The subject as a geojson poly
 * @param  {[type]} cPoly     The clipper as a geojson poly
 * @param  {[type]} s_forward Whether the subject traversal is forward or backward
 * @param  {[type]} c_forward Whether the clipper traversal is forward or backward
 * @return {[type]}           [description]
 */
function processPolygons(list, subject, clipper, sPoly, cPoly, s_forward, c_forward) {
  if (list.length != 0) {
    return list;
  }
  // Union Mode.
  //
  // - If the list is empty, the polys didn't intersect
  // but should still be returned as a multipolygon
  // - OR, the shapes are literally the same shape.
  if (!s_forward && !c_forward) {
    if (equals.compare(sPoly, cPoly)) {
      return [[subject]];
    }
    return [[subject], [clipper]];
  }

  // Intersect Mode.
  //
  // - If the list is empty, either the polygons
  // are disjoint, or they are literally the same polygon. So
  // we'll check to for equality
  if (s_forward && c_forward) {
    if (equals.compare(sPoly, cPoly)) {
      return [[subject]];
    }
  }

  // Subtract Modes
  if (s_forward ^ c_forward == 1) {
    var testpt, testpoly, outer, hole;

    if (!s_forward && c_forward) {
      // Subtract A - B
      testpt = turfPoint(clipper[0]);
      testpoly = sPoly;
      outer = subject;
      hole = clipper;
    } else {
      // Subtract B - A
      testpt = turfPoint(subject[0]);
      testpoly = cPoly;
      outer = clipper;
      hole = subject;
    }

    var inside  = turfInside(testpt, testpoly);

    // If the testpt is inside, then "hole" is *actually* a
    // hole, so we should return the outer and the hole both
    if (inside) {

      return [[outer, hole]];
    } else {
      // IF the hole isn't inside the polygon, then
      // there was no overlap, so outer - hole = outer
      return [[outer]];
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
function buildPolygons(sPoints) {
  var curr = sPoints.first;
  var polylist = [];

  while (curr = sPoints.firstIntersect()) {
    var poly = [[curr.x, curr.y]];

    do {
      curr.checked = true;
      if (curr.neighbor) {
        curr.neighbor.checked = true;
      }

      if (curr.entry) {
        do {
          curr = curr.next;
          poly.push([curr.x, curr.y]);
        } while (!curr.intersect);
      } else {
        do {
          curr = curr.prev;
          poly.push([curr.x, curr.y]);
        } while (!curr.intersect);
      }

      // Jump to the other list
      curr = curr.neighbor
    } while (!curr.checked);
    //poly.push(poly[0])
    polylist.push([poly])
  }

  return polylist;
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
      } while (cCurr != cPoints.first);
    }

    sCurr = sCurr.next;
  } while (sCurr != sPoints.first);
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
    if (turfInside(turfPoint([pt.x, pt.y]), poly)) {
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
 * @param {Ring}    list     [description]
 * @param {boolean} sForward [description]
 * @param {boolean} cForward [description]
 * @param {Polygon} sPoly    [description]
 * @param {Polygon} cPoly    [description]
 */
function setEntryExit(list, list2, s_forward, c_forward, sPoly, cPoly) {
  var curr = list.first;
  var sForward = s_forward;
  var cForward = c_forward;

  do {
    if (curr.intersect) {
      var remove = (curr.areTypesEqual() && curr.neighbor.areTypesEqual());
      handleEntryAndType(curr, sForward, cForward, remove);
      handleEntryAndType(curr.neighbor, cForward, sForward, remove);

      if (!remove && curr.entryIs(!sForward, !cForward)) {
        remove = true;
        curr.type = 'out';
        curr.neighbor.type = 'out';
      } else if (!remove && curr.entryIs(sForward, cForward)) {
        remove = true;
        curr.type = 'in';
        curr.neighbor.type = 'in';
      }
      if (remove) {
        curr.intersect = false;
        curr.neighbor.intersect = false;
      }
    }
    curr = curr.next;
  } while (curr != list.first);
}

/**
 * Handles setting the entry/exit flag as well as readjusting the "type"
 * flag for a given vertex, given it's neighbors. This is part of the
 * GH degeneracy handling.
 *
 * @param  {Vertex}  curr   The vertex to flag
 * @param  {boolean} entry  Vertex entry flag
 * @param  {boolean} nEntry Neighbor entry flags
 * @param  {boolean} remove Whether we've detected that this Vertex should be
 *                          removed from the intersections list
 * @return {[type]}
 */
function handleEntryAndType(curr, entry, nEntry, remove) {
  if (curr.typeIs('on', 'on')) {
    if (!curr.neighbor.typeIs('on', 'on')) {
      handleEntryAndType(curr.neighbor, nEntry, entry, remove);
      if (entry == nEntry) {
        curr.entry = !curr.neighbor.entry
      } else {
        curr.entry = curr.neighbor.entry
      }

      if (remove) {
        if (curr.neighbor.type == 'in') {
          curr.type = 'out';
        } else {
          curr.type = 'in';
        }
      }
    } else {
      curr.type = 'in';
    }
  } else if (curr.typeIs('out', 'out') && remove) {
    curr.type = 'out';
  } else if (curr.typeIs('in', 'in') && remove) {
    curr.type = 'in';
  } else if (curr.typeIs('on', 'out') || curr.typeIs('in', 'on') || curr.typeIs('in', 'out')) {
    curr.entry = !entry;
  } else if (curr.typeIs('on', 'in') || curr.typeIs('out', 'on') || curr.typeIs('out', 'in')) {
    curr.entry = entry;
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


// Log all points
function logPoints(sPoints, cPoints) {
  var curr = sPoints.first
  do {
    logPoint(curr);
    curr = curr.next
  } while (curr != sPoints.first)
  console.log("-----------------")
  var curr = cPoints.first
  do {
    logPoint(curr);
    curr = curr.next
  } while (curr != cPoints.first)
}

// Log only intersections (or degeneracies that used to be intersections)
function logIntersections(sPoints) {
  console.log("-------------------")
  console.log("INTERSECTION LIST: ")
  console.log("-------------------")
  var curr = sPoints.first
  do {
    if (curr.intersect || curr.degenerate) {
      logPoint(curr);
    }
    curr = curr.next
  } while (curr != sPoints.first)
  console.log("")
}

// Log a point
function logPoint(curr) {
  console.log(curr.x + ", "+curr.y
      +" INTERSECT: "+ (curr.intersect ? "Yes" : "No ")
      +" ENTRY: "+(curr.entry ? "Yes": "No ")
      +" DEGEN: "+(curr.degenerate ? "Yes": "No ")
      +" TYPE: "+String(curr.prev.type+" ").slice(0, 3)
          +" / "+String(curr.type+" ").slice(0, 3)
          +" / "+String(curr.next.type+" ").slice(0, 3)
      +" ALPHA: "+curr.alpha
    );
}

},{"./ring":4,"./vertex":8,"geojson-equality":9,"turf-inside":13,"turf-is-clockwise":14,"turf-point":15,"turf-polygon":16}],3:[function(require,module,exports){
var ghClipping = require('./greiner-hormann');
var turfInside = require('turf-inside');
var turfPoint = require('turf-point');
var turfPolygon = require('turf-polygon');
var union = require('./union');
var utils = require('./util');
var subtract = require('./subtract');

module.exports = function(subject, clipper) {
  var subject = utils.clone(subject);
  var clipper = utils.clone(clipper);
  var hulls = utils.outerHulls(subject).concat(utils.outerHulls(clipper));
  var holes = utils.holes(subject).concat(utils.holes(clipper));
  var result = [];

  // Intersect all hulls
  for (var i = 0; i < hulls.length; i++) {
    for (var j = i+1; j < hulls.length; j++) {
      var test = ghClipping(hulls[i], hulls[j], true, true);
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

},{"./greiner-hormann":2,"./subtract":5,"./union":6,"./util":7,"turf-inside":13,"turf-point":15,"turf-polygon":16}],4:[function(require,module,exports){
Vertex = require('./vertex');
/**
 * Ring is a *circular* doubly-linked list; Every node
 * has a next and a prev, even if it's the only node in the list.
 *
 * This supports some search methods that need to wrap back to the start of the list.
 */
function Ring () {
    this.first = null;
}

/**
 * Takes an array of coordinates and constructs a Ring
 *
 * @param  {array} coordinates [description]
 * @return {Ring}             [description]
 */
Ring.fromCoords = function(coordinates) {
    var ring = new Ring()

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
 * @param  {Vertex} vertex [description]
 * @return {[type]}        [description]
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
 * @param  {Vertex} vertex [description]
 * @param  {Vertex} start  [description]
 * @param  {Vertex} end    [description]
 * @return {[type]}        [description]
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
 * Start at the start vertx, and get the next
 * point that *isn't* an intersection
 *
 * @param  {Vertex} start [description]
 * @return {Vertex}       [description]
 */
Ring.prototype.nextNonIntersect = function (start) {
    var curr = start;
    while (curr.intersect && curr != this.first && curr.next != this.first) {
        curr = curr.next
    }
    return curr;
}

/**
 * Returns the first unchecked intersection in the list
 *
 * @return {[type]} [description]
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

},{"./vertex":8}],5:[function(require,module,exports){
var util = require('./util');
var ghClipping = require('./greiner-hormann');

module.exports = function(subject, clip) {
  subject = util.clone(subject);
  clip = util.clone(clip);

  // TODO:
  // Subtract each outer hull of the clip from the subject
  // If there are any holes in the subject, subtract those as well
  // If there are any holes in the clip, which overlap the original
  // subject, these should be unioned in. This means we'll have to
  // check polygon within-ness for each clip hole

  // Next we'll subtract each hole from each intersection polygon.
  for (var i = 0; i < clip.length; i++) {
    var ilen = subject.length;
    for (var j = 0; j < subject.length; j++) {
      var test = ghClipping(subject[j][0], clip[i], false, true);

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
      clip.splice(i, 1)
      i--;
    }
  }

  return subject;
}

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
function unionRings(rings)
{
  for (var i = 0; i < rings.length; i++) {
    for (var j = i+1; j < rings.length; j++) {
      if (i == j) {
        continue;
      }
      var test = utils.outerHulls(ghClipping(rings[i], rings[j], false, false));

      // If the length is 1, we joined the two areas, so replace
      // rings[i] with the new shape, and remove rings[j]
      // Then reset the j iterator so we can make sure that none of
      // the previous rings will now overlap the new rings[i]
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
// to make things faster for complex / very degenerate sets
module.exports = function(coords, coords2) {
  if (typeof coords2 != 'undefined' && coords2 != null) {
    var coords = coords.concat(coords2);
  }

  var coords = utils.clone(coords);
  var hulls = utils.outerHulls(coords);
  var holes = utils.holes(coords);

  // Union all hulls
  hulls = utils.wrapToPolygons(unionRings(hulls));

  // Union all holes - If holes overlap, they should be joined
  if (holes.length > 0) {
    holes = unionRings(holes);

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
    this.justMarked = false;
}

Vertex.prototype.equals = function(other) {
    if (this.x == other.x && this.y == other.y) {
        return true;
    }
    return false;
};

Vertex.prototype.typeIs = function(p, n) {
    if (this.prev.type == p && this.next.type == n) {
        return true;
    }
    return false;
};

Vertex.prototype.areTypesEqual = function () {
    if (this.typeIs('on', 'on') || this.typeIs('out', 'out') || this.typeIs('in','in')) {
        return true;
    }
    return false;
}


Vertex.prototype.entryIs = function(curr, neighbor) {
    if (this.entry == curr && this.neighbor.entry == neighbor) {
        return true;
    }
    return false;
}

module.exports = Vertex;

},{}],9:[function(require,module,exports){
//index.js
var deepEqual = require('deep-equal');

var Equality = function(opt) {
  this.precision = opt && opt.precision ? opt.precision : 17;
  this.direction = opt && opt.direction ? opt.direction : false;
  this.pseudoNode = opt && opt.pseudoNode ? opt.pseudoNode : false;
  this.objectComparator = opt && opt.objectComparator ? opt.objectComparator : objectComparator;
};

Equality.prototype.compare = function(g1,g2) {
  if (g1.type !== g2.type || !sameLength(g1,g2)) return false;

  switch(g1.type) {
  case 'Point':
    return this.compareCoord(g1.coordinates, g2.coordinates);
    break;
  case 'LineString':
    return this.compareLine(g1.coordinates, g2.coordinates,0,false);
    break;
  case 'Polygon':
    return this.comparePolygon(g1,g2);
    break;
  case 'Feature':
    return this.compareFeature(g1, g2);
  default:
    if (g1.type.indexOf('Multi') === 0) {
      var context = this;
      var g1s = explode(g1);
      var g2s = explode(g2);
      return g1s.every(function(g1part) {
        return this.some(function(g2part) {
          return context.compare(g1part,g2part);
        });
      },g2s);
    }
  }
  return false;
};

function explode(g) {
  return g.coordinates.map(function(part) {
    return {
      type: g.type.replace('Multi', ''),
      coordinates: part}
  });
}
//compare length of coordinates/array
function sameLength(g1,g2) {
   return g1.hasOwnProperty('coordinates') ?
    g1.coordinates.length === g2.coordinates.length
    : g1.length === g2.length;
}

// compare the two coordinates [x,y]
Equality.prototype.compareCoord = function(c1,c2) {
  return c1[0].toFixed(this.precision) === c2[0].toFixed(this.precision)
    && c1[1].toFixed(this.precision) === c2[1].toFixed(this.precision);
};

Equality.prototype.compareLine = function(path1,path2,ind,isPoly) {
  if (!sameLength(path1,path2)) return false;
  var p1 = this.pseudoNode ? path1 : this.removePseudo(path1);
  var p2 = this.pseudoNode ? path2 : this.removePseudo(path2);
  if (isPoly && !this.compareCoord(p1[0],p2[0])) {
    // fix start index of both to same point
    p2 = this.fixStartIndex(p2,p1);
    if(!p2) return;
  }
  // for linestring ind =0 and for polygon ind =1
  var sameDirection = this.compareCoord(p1[ind],p2[ind]);
  if (this.direction || sameDirection
  ) {
    return this.comparePath(p1, p2);
  } else {
    if (this.compareCoord(p1[ind],p2[p2.length - (1+ind)])
    ) {
      return this.comparePath(p1.slice().reverse(), p2);
    }
    return false;
  }
};
Equality.prototype.fixStartIndex = function(sourcePath,targetPath) {
  //make sourcePath first point same as of targetPath
  var correctPath,ind = -1;
  for (var i=0; i< sourcePath.length; i++) {
    if(this.compareCoord(sourcePath[i],targetPath[0])) {
      ind = i;
      break;
    }
  }
  if (ind >= 0) {
    correctPath = [].concat(
      sourcePath.slice(ind,sourcePath.length),
      sourcePath.slice(1,ind+1));
  }
  return correctPath;
};
Equality.prototype.comparePath = function (p1,p2) {
  var cont = this;
  return p1.every(function(c,i) {
    return cont.compareCoord(c,this[i]);
  },p2);
};

Equality.prototype.comparePolygon = function(g1,g2) {
  if (this.compareLine(g1.coordinates[0],g2.coordinates[0],1,true)) {
    var holes1 = g1.coordinates.slice(1,g1.coordinates.length);
    var holes2 = g2.coordinates.slice(1,g2.coordinates.length);
    var cont = this;
    return holes1.every(function(h1) {
      return this.some(function(h2) {
        return cont.compareLine(h1,h2,1,true);
      });
    },holes2);
  } else {
    return false;
  }
};

Equality.prototype.compareFeature = function(g1,g2) {
  if (
    g1.id !== g2.id ||
    !this.objectComparator(g1.properties, g2.properties)
  ) {
    return false;
  }

  return this.compare(g1.geometry, g2.geometry);
};

Equality.prototype.removePseudo = function(path) {
  //TODO to be implement
  return path;
};

function objectComparator(obj1, obj2) {
  return deepEqual(obj1, obj2, {strict: true});
}

module.exports = Equality;

},{"deep-equal":10}],10:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":11,"./lib/keys.js":12}],11:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],12:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],13:[function(require,module,exports){
// http://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
// modified from: https://github.com/substack/point-in-polygon/blob/master/index.js
// which was modified from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

/**
 * Takes a {@link Point} feature and a {@link Polygon} feature and determines if the Point resides inside the Polygon. The Polygon can
 * be convex or concave. The function accepts any valid Polygon or {@link MultiPolygon}
 * and accounts for holes.
 *
 * @module turf/inside
 * @category joins
 * @param {Point} point a Point feature
 * @param {Polygon} polygon a Polygon feature
 * @return {Boolean} `true` if the Point is inside the Polygon; `false` if the Point is not inside the Polygon
 * @example
 * var pt1 = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": "#f00"
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-111.467285, 40.75766]
 *   }
 * };
 * var pt2 = {
 *   "type": "Feature",
 *   "properties": {
 *     "marker-color": "#0f0"
 *   },
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [-111.873779, 40.647303]
 *   }
 * };
 * var poly = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Polygon",
 *     "coordinates": [[
 *       [-112.074279, 40.52215],
 *       [-112.074279, 40.853293],
 *       [-111.610107, 40.853293],
 *       [-111.610107, 40.52215],
 *       [-112.074279, 40.52215]
 *     ]]
 *   }
 * };
 *
 * var features = {
 *   "type": "FeatureCollection",
 *   "features": [pt1, pt2, poly]
 * };
 *
 * //=features
 *
 * var isInside1 = turf.inside(pt1, poly);
 * //=isInside1
 *
 * var isInside2 = turf.inside(pt2, poly);
 * //=isInside2
 */
module.exports = function(point, polygon) {
  var polys = polygon.geometry.coordinates;
  var pt = [point.geometry.coordinates[0], point.geometry.coordinates[1]];
  // normalize to multipolygon
  if(polygon.geometry.type === 'Polygon') polys = [polys];

  var insidePoly = false;
  var i = 0;
  while (i < polys.length && !insidePoly) {
    // check if it is in the outer ring first
    if(inRing(pt, polys[i][0])) {
      var inHole = false;
      var k = 1;
      // check for the point in any of the holes
      while(k < polys[i].length && !inHole) {
        if(inRing(pt, polys[i][k])) {
          inHole = true;
        }
        k++;
      }
      if(!inHole) insidePoly = true;
    }
    i++;
  }
  return insidePoly;
}

// pt is [x,y] and ring is [[x,y], [x,y],..]
function inRing (pt, ring) {
  var isInside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    
    var intersect = ((yi > pt[1]) != (yj > pt[1]))
        && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}


},{}],14:[function(require,module,exports){
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
},{}],15:[function(require,module,exports){
/**
 * Takes coordinates and properties (optional) and returns a new {@link Point} feature.
 *
 * @module turf/point
 * @category helper
 * @param {number} longitude position west to east in decimal degrees
 * @param {number} latitude position south to north in decimal degrees
 * @param {Object} properties an Object that is used as the {@link Feature}'s
 * properties
 * @return {Point} a Point feature
 * @example
 * var pt1 = turf.point([-75.343, 39.984]);
 *
 * //=pt1
 */
var isArray = Array.isArray || function(arg) {
  return Object.prototype.toString.call(arg) === '[object Array]';
};
module.exports = function(coordinates, properties) {
  if (!isArray(coordinates)) throw new Error('Coordinates must be an array');
  if (coordinates.length < 2) throw new Error('Coordinates must be at least 2 numbers long');
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: coordinates
    },
    properties: properties || {}
  };
};

},{}],16:[function(require,module,exports){
/**
 * Takes an array of LinearRings and optionally an {@link Object} with properties and returns a GeoJSON {@link Polygon} feature.
 *
 * @module turf/polygon
 * @category helper
 * @param {Array<Array<Number>>} rings an array of LinearRings
 * @param {Object} properties an optional properties object
 * @return {Polygon} a Polygon feature
 * @throws {Error} throw an error if a LinearRing of the polygon has too few positions
 * or if a LinearRing of the Polygon does not have matching Positions at the
 * beginning & end.
 * @example
 * var polygon = turf.polygon([[
 *  [-2.275543, 53.464547],
 *  [-2.275543, 53.489271],
 *  [-2.215118, 53.489271],
 *  [-2.215118, 53.464547],
 *  [-2.275543, 53.464547]
 * ]], { name: 'poly1', population: 400});
 *
 * //=polygon
 */
module.exports = function(coordinates, properties){

  if (coordinates === null) throw new Error('No coordinates passed');

  for (var i = 0; i < coordinates.length; i++) {
    var ring = coordinates[i];
    for (var j = 0; j < ring[ring.length - 1].length; j++) {
      if (ring.length < 4) {
        throw new Error('Each LinearRing of a Polygon must have 4 or more Positions.');
      }
      if (ring[ring.length - 1][j] !== ring[0][j]) {
        throw new Error('First and last Position are not equivalent.');
      }
    }
  }

  var polygon = {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": coordinates
    },
    "properties": properties
  };

  if (!polygon.properties) {
    polygon.properties = {};
  }

  return polygon;
};

},{}]},{},[1])(1)
});


//# sourceMappingURL=greiner-hormann.js.map