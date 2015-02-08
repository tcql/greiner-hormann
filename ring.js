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

module.exports = {Ring: Ring, Vertex: Vertex};
