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
    if (coordinates instanceof Ring) {
        return coordinates;
    }

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
