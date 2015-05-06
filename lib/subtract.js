var util = require('./util');
var ghClipping = require('./greiner-hormann');
var preprocessPoly = require('point-in-big-polygon');
var intersect = require('./intersect');


module.exports = function(subject, clip) {
  subject = util.clone(subject);
  clip = util.clone(clip);

  var s_hulls = util.outerHulls(subject);
  var c_hulls = util.outerHulls(clip);
  var s_holes = util.holes(subject);
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

  // Next we'll subtract each hole from each intersection polygon.
  for (var i = 0; i < c_hulls.length; i++) {
    var ilen = s_hulls.length;
    for (var j = 0; j < s_hulls.length; j++) {
      var test = ghClipping(s_hulls[j], c_hulls[i], false, true);
      // Copy the primary hull of the intersect record that
      // we just clipped against the hull
      s_hulls[j] = test[0][0];
      // // Copy in each hole (if there were any) for the primary hull
      // for (var k = 1; k < test[0].length; k++) {
      //   s_hulls[j].push(test[0][k]);
      // }

      // If there are any additional polygons in the result,
      // they were newly created by intersecting this hole.
      // Push the new polygon (hull and any holes) straight
      // into the intersect list
      for (var k = 1; k < test.length; k++) {
        // console.log("puushing[")
        s_hulls.push(test[k][0]);
      }
    }

    // If the length has changed, this hole created
    // new intersection polygons, which means it's not a hole
    // anymore (it crossed the polys, now it's boundary is
    // part of the new intersection hulls). Therefore, we
    // remove this hole from the list so it won't be returned.
    if (ilen != s_hulls.length) {
      c_hulls.splice(i, 1)
      i--;
    }
  }

  return s_hulls;
}
