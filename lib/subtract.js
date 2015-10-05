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
  return result;
}

function subtract(subject, clip, skiploop) {
  skiploop = !!skiploop;
  subject = util.clone(subject);
  clip = util.clone(clip);

  var sHulls = util.outerHulls(subject);
  var cHulls = util.outerHulls(clip);
  var cHoles = util.holes(clip);

  // TODO:
  // If there are any holes in the subject, subtract those as well
  // If there are any holes in the clip, which overlap the original
  // subject, these should be unioned in. This means we'll have to
  // check polygon within-ness for each clip hole

  // first intersect any holes in clip against the hulls in the subject.
  // If there are results from these, then these holes overlap the subject,
  // meaning they (or some part of them) will be saved in the final output as
  // outer hulls
  if (cHoles.length > 0) {
    cHoles = intersect(sHulls, cHoles);
  }

  if (util.isPolygon(subject)) {
    subject = [subject];
  } else {
    subject = util.wrapToPolygons(subject);
  }

  for (var i = 0; i < cHulls.length; i++) {
    var ilen = subject.length;
    for (var j = 0; j < subject.length; j++) {
      var test = ghClipping(subject[j][0], cHulls[i], false, true);
      if (test.length === 0) {
        subject.splice(j, 1);
        j--;
        continue;
      }

      subject[j][0] = test[0][0];

      // Copy in each hole (if there were any) for the primary hull
      for (var k = 1; k < test[0].length; k++) {
        subject[j].push(test[0][k]);
      }

      // If there are any additional polygons in the result,
      // they were newly created by intersecting this hole.
      // Push the new polygon (hull and any holes) straight
      // into the intersect list
      for (var l = 1; l < test.length; l++) {
        subject.push(test[l]);
      }
    }

    // If the length has changed, this hole created
    // new intersection polygons, which means it's not a hole
    // anymore (it crossed the polys, now it's boundary is
    // part of the new intersection hulls). Therefore, we
    // remove this hole from the list so it won't be returned.
    if (ilen !== subject.length) {
      cHulls.splice(i, 1);
      i--;
    }
  }

  // Union remaining clip-polygon holes if they exist.
  if (cHoles.length > 0) {
    subject = subject.concat(util.wrapToPolygons(cHoles));
  }

  // Re-cut everything against the subject's holes to be
  // 100% certain they don't change any information in the output
  var sHoles = util.unionRings(util.holes(subject), []);

  if (sHoles.length > 0 && !skiploop) {
    return subtract(util.wrapToPolygons(util.outerHulls(subject)), util.wrapToPolygons(sHoles), true);
  }

  return subject;
}


module.exports = subtract;
