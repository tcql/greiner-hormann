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


  logPoints(sPoints, cPoints);
  /**
   * PHASE TWO: Identify Entry/Exit
   */
  setEntryExit(sPoints, cPoints, s_forward, c_forward, sPoints, cPoints);
  /**
   * PHASE THREE: Build clipped polys
   */
  var list = buildPolygons(sPoints);
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
function setEntryExit(sPoints, cPoints, sForward, cForward, sPoly, cPoly)
{
  var first = sPoints.first;
  var curr = first;

  do {
    if (curr.intersect && curr.neighbor) {
      handleEnEx(curr);
      handleEnEx(curr.neighbor);
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


function handleEnEx(curr)
{
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
        if (np == "out/out" || np == "in/in" || np == "on/on" || np == "on/out") {
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


// Log all points
function logPoints(sPoints, cPoints) {
  var curr = sPoints.first
  do {
    logPoint(curr);
    curr = curr.next
  } while (curr != sPoints.first)
  console.log("-----------------")
  if (!cPoints) return;
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
  console.log(
      "INTERSECT: "+ (curr.intersect ? "Yes" : "No ")
      +" ENTRY: "+(curr.entry ? "Yes": "No ")
      +" DEGEN: "+(curr.degenerate ? "Yes": "No ")
      +" TYPE: "+String(curr.prev.type+" ").slice(0, 3)
          +" / "+String(curr.type+" ").slice(0, 3)
          +" / "+String(curr.next.type+" ").slice(0, 3)
      +" ALPHA: "+ curr.alpha.toPrecision(3)
      +" REMOVE: "+ (curr.remove ? "Yes": "No") + " "
      +curr.x + ", "+curr.y

    );
}
