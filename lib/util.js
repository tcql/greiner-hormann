if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

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

exports.wrap = function(array) {
  var wrapped = [];
  for(var i = 0; i < array.length; i++) {
    wrapped.push([array[i]])
  }
  return wrapped;
}
