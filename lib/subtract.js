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
