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
    this.remove = false;
}

Vertex.prototype.pairing = function () {
    return this.prev.type + "/" + this.next.type;
}

Vertex.prototype.entryPair = function() {
    var entry = this.entry ? "en" : "ex";
    var nEntry = this.neighbor.entry ? "en" : "ex";

    return entry+"/"+nEntry;
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

module.exports = Vertex;
