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
  subject = sPoints.toArray();
  clipper = cPoints.toArray();


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
  return buildPolygons(sPoints, s_forward, c_forward);
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
    var poly = new Ring;
    poly.push(new Vertex(curr.x, curr.y))

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
            poly.push(new Vertex(curr.x, curr.y));
        } while (!curr.intersect);
      } else {
        do {
          curr = curr[exdir];
          poly.push(new Vertex(curr.x, curr.y));
        } while (!curr.intersect);
      }

      // Jump to the other list
      curr = curr.neighbor;
      onclip = !onclip;

    } while (!curr.checked);

    if (poly.count() < 3) {
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
      if (pip(polylist[j].geom.first.asPoint(), polylist[i].geom.toArray())) {
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
    var poly = { hull: polylist[key].geom, holes: [] };
    graph[key].forEach(function (idx) {
      poly.holes.push(polylist[idx].geom);
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


