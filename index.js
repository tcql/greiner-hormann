var intersect = require('./lib/intersect');
var union = require('./lib/union');
var utils = require('./lib/util');


module.exports = {
  union: union,
  intersect: intersect,

  // include utils to make things easier
  utils: utils
};



// module.exports = function(subject, clipper) {
//   // TODO: make this work with more interesting geometries
//   var subCoords = subject.geometry ? subject.geometry.coordinates : subject.coordinates;
//   var clipCoords = clipper.geometry ? clipper.geometry.coordinates : clipper.coordinates;

//   // According to GeoJSON spec, the first element in a set of polygon rings
//   // *MUST* be the outer ring. So that's where we start.
//   var is = intersect(subCoords, clipCoords);

//   if (!is) {
//     is = [];
//   }

//   if (is.length == 0) {
//     // console.log("No intersection")
//     // TODO: Handle this?
//   } else if (is.length == 1) {
//     return turfPolygon(is[0]);
//   } else {
//     return {
//       "type": "Feature",
//       "properties": {},
//       "geometry": {
//         "type": "MultiPolygon",
//         "coordinates": is
//       }
//     };
//   }
// }
