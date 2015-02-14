var intersect = require('./lib/intersect');
var union = require('./lib/union');
var utils = require('./lib/util');


module.exports = {
  union: union,
  intersect: intersect,

  // include utils to make things easier
  utils: utils
};
