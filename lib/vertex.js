function Vertex (x, y, alpha, intersect, degenerate) {
    this.x = x;
    this.y = y;
    this.reset();

    this.alpha = alpha || 0.0;
    this.intersect = intersect || false;
    this.degenerate = degenerate || false;

}

/**
 * Reset this vertex to it's initial state
 */
Vertex.prototype.reset = function () {
    this.alpha = 0.0;
    this.intersect = false;
    this.degenerate = false;
    this.entry = true; // Set to true by default, for degeneracy handling
    this.checked = false;
    this.neighbor = null;
    this.next = null;
    this.prev = null;
    this.type = null; // can be "in", "out", "on"
    this.remove = false;
};

/**
 * Returns a string representing the types of the previous and next vertices.
 * For example, if the prev vertex had type "in" and the next had type "out",
 * the pairing would be "in/out". This matches the way pairs are referenced in
 * the Greiner-Hormann Degeneracy paper.
 *
 * @return {String} the pairing description
 */
Vertex.prototype.pairing = function () {
    return this.prev.type + "/" + this.next.type;
}

/**
 * Returns a string representing the entry / exit flag of this vertex and it's neighbor
 * For example, if the current vertex was flagged entry = true and it's neighbor was flagged
 * entry = false, the entryPair would be "en/ex" (short for "entry/exit"). This matches the
 * way flags are referenced in the Greiner-Hormann Degeneracy paper.
 *
 * @return {String} the entry/exit pair string
 */
Vertex.prototype.entryPair = function() {
    var entry = this.entry ? "en" : "ex";
    var nEntry = this.neighbor.entry ? "en" : "ex";

    return entry+"/"+nEntry;
}

/**
 * Determine if this vertex is equal to another
 *
 * @param  {Vertex} other the vertex to compare with
 * @return {bool}   whether or not the vertices are equal
 */
Vertex.prototype.equals = function(other) {
    if (this.x == other.x && this.y == other.y) {
        return true;
    }
    return false;
};

/**
 * Utility method to log the vertex, only for debugging
 */
Vertex.prototype.log = function() {
  console.log(
      "INTERSECT: "+ (this.intersect ? "Yes" : "No ")
      +" ENTRY: "+(this.entry ? "Yes": "No ")
      +" DEGEN: "+(this.degenerate ? "Yes": "No ")
      +" TYPE: "+String(this.prev.type+" ").slice(0, 3)
          +" / "+String(this.type+" ").slice(0, 3)
          +" / "+String(this.next.type+" ").slice(0, 3)
      +" ALPHA: "+ this.alpha.toPrecision(3)
      +" REMOVE: "+ (this.remove ? "Yes": "No") + " "
      +this.x + ", "+this.y
    );
};

Vertex.prototype.asPoint = function () {
  return [this.x, this.y];
}


module.exports = Vertex;
