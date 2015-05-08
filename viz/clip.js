(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.polyclip = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/tcql/Code/turf-plugins/polyclip/node_modules/tinyqueue/index.js":[function(require,module,exports){
'use strict';

module.exports = TinyQueue;

function TinyQueue(data, compare) {
    this.data = data || [];
    this.length = this.data.length;
    this.compare = compare || defaultCompare;

    if (data) for (var i = Math.floor(this.length / 2); i >= 0; i--) this._down(i);
}

function defaultCompare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

TinyQueue.prototype = {

    push: function (item) {
        this.data.push(item);
        this.length++;
        this._up(this.length - 1);
    },

    pop: function () {
        var top = this.data[0];
        this.data[0] = this.data[this.length - 1];
        this.length--;
        this.data.pop();
        this._down(0);
        return top;
    },

    peek: function () {
        return this.data[0];
    },

    _up: function (pos) {
        var data = this.data,
            compare = this.compare;

        while (pos > 0) {
            var parent = Math.floor((pos - 1) / 2);
            if (compare(data[pos], data[parent]) < 0) {
                swap(data, parent, pos);
                pos = parent;

            } else break;
        }
    },

    _down: function (pos) {
        var data = this.data,
            compare = this.compare,
            len = this.length;

        while (true) {
            var left = 2 * pos + 1,
                right = left + 1,
                min = pos;

            if (left < len && compare(data[left], data[min]) < 0) min = left;
            if (right < len && compare(data[right], data[min]) < 0) min = right;

            if (min === pos) return;

            swap(data, min, pos);
            pos = min;
        }
    }
};

function swap(data, i, j) {
    var tmp = data[i];
    data[i] = data[j];
    data[j] = tmp;
}

},{}],"/home/tcql/Code/turf-plugins/polyclip/polyclip.js":[function(require,module,exports){
'use strict';

var Queue = require('tinyqueue');

module.exports = clip;

var sqrEpsilon = 1e-10;

clip.INTERSECTION = 0;
clip.UNION = 1;

var EDGE_NORMAL = 0,
    EDGE_NON_CONTRIBUTING = 1,
    EDGE_SAME_TRANSITION = 2,
    EDGE_DIFFERENT_TRANSITION = 3;

function clip(subject, clipping, type) {
    var events = [],
        result = [],
        i, e, edgeList;

    type = type || clip.INTERSECTION;

    for (i = 0; i < subject.length; i++) addToEvents(events, subject[i], true);
    for (i = 0; i < clipping.length; i++) addToEvents(events, clipping[i], false);

    var queue = new Queue(events, compareEvent);

    while (queue.length) {
        e = queue.pop();

        if (e.left) {
            edgeList = edgeListInsert(edgeList, e);

            setFlags(e, e.prev, type);

            handleIntersections(queue, e, e.next);
            handleIntersections(queue, e, e.prev);

        } else {
            e = e.other;

            var inResult =
                e.type === EDGE_NON_CONTRIBUTING ? false :
                type === clip.INTERSECTION ? e.inside || e.type === EDGE_SAME_TRANSITION :
                type === clip.UNION ? !e.inside || e.type === EDGE_SAME_TRANSITION : false;

            if (inResult) result.push([e.p, e.other.p]);

            edgeList = edgeListRemove(edgeList, e);

            handleIntersections(queue, e.prev, e.next);
        }
    }

    return result;
}

function edgeListInsert(edgeList, e) {
    if (!edgeList) return e;

    var next = edgeList,
        prev;

    while (next && compareEdge(e, next) > 0) {
        prev = next;
        next = next.next;
    }

    if (prev) {
        prev.next = e;
        e.prev = prev;

    } else {
        edgeList = e;
    }

    e.next = next;
    if (next) next.prev = e;

    return edgeList;
}

function edgeListRemove(edgeList, e) {
    if (e.prev) e.prev.next = e.next;
    else edgeList = e.next;

    if (e.next) e.next.prev = e.prev;

    return edgeList;
}

function addToEvents(events, ring, isSubject) {
    var i, j, len, e1, e2;
    for (i = 0, len = ring.length, j = len - 1; i < len; j = i++) {

        if (equals(ring[i], ring[j])) continue;

        e1 = sweepEvent(ring[i], isSubject);
        e2 = sweepEvent(ring[j], isSubject);
        e1.other = e2;
        e2.other = e1;

        if (compareEvent(e1, e2) < 0) e1.left = true;
        else e2.left = true;

        events.push(e1);
        events.push(e2);
    }
}

function setFlags(e, e0) {
    if (!e0) {
        e.inOut = false;
        e.inside = false;

    } else if (e.subject === e0.subject) {
        e.inOut = !e0.inOut;
        e.inside = e0.inside;

    } else {
        e.inOut = e0.inside;
        e.inside = !e0.inOut;
    }
}

function handleIntersections(queue, e1, e2) {
    if (!e1 || !e2) return;

    var p1 = e1.p,
        p1b = e1.other.p,
        p2 = e2.p,
        p2b = e2.other.p,

        ex = p2[0] - p1[0],
        ey = p2[1] - p1[1],
        d1x = p1b[0] - p1[0],
        d1y = p1b[1] - p1[1],
        d2x = p2b[0] - p2[0],
        d2y = p2b[1] - p2[1],
        cross = d1x * d2y - d1y * d2x,
        sqrLen0 = d1x * d1x + d1y * d1y,
        sqrLen1 = d2x * d2x + d2y * d2y;

    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLen1) {
        // lines are not parallel
        var s = (ex * d2y - ey * d2x) / cross;
        if (s < 0 || s > 1) return;

        var t = (ex * d1y - ey * d1x) / cross;
        if (t < 0 || t > 1) return;

        var p = [p1[0] + s * d1x, p1[1] + s * d1y];

        if (!equals(p, p1) && !equals(p, p1b)) subdivideEdge(queue, e1, p);
        if (!equals(p, p2) && !equals(p, p2b)) subdivideEdge(queue, e2, p);
        return;
    }

    // lines are parallel
    var sqrLenE = ex * ex + ey * ey;
    cross = ex * d1y - ey * d1x;
    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLenE) return; // lines are different

    if (e1.subject === e2.subject) return;

    // lines are colinear
    var s0 = (d1x * ex + d1y * ey) / sqrLen0,
        s1 = s0 + (d1x * d2x + d1y * d2y) / sqrLen0;

    if (s0 >= 1 || s1 <= 0) return; // no overlap

    // lines overlap
    if (s0 <= 0) {
        var e3 = s0 < 0 ? subdivideEdge(queue, e2, p1) : e2;

        e1.type = EDGE_NON_CONTRIBUTING;
        e3.type = e1.inOut === e2.inOut ? EDGE_SAME_TRANSITION : EDGE_DIFFERENT_TRANSITION;

        if (s1 < 1) subdivideEdge(queue, e1, p2b);
        else if (s1 > 1) subdivideEdge(queue, e3, p1b);

    } else {
        console.log('unhandled overlap', p1, p1b, p2, p2b, s0, s1);
    }
}

function subdivideEdge(queue, e, p) {
    var e1 = sweepEvent(p, e.subject),
        e2 = sweepEvent(p, e.subject),
        e3 = e.other;

    e2.left = true;

    e.other = e1;
    e1.other = e;

    e2.other = e3;
    e3.other = e2;

    queue.push(e1);
    queue.push(e2);

    return e2;
}

function sweepEvent(p, isSubject) {
    return {
        p: p,
        prev: null,
        next: null,
        other: null,
        subject: isSubject,
        left: false,
        inOut: false,
        inside: false,
        type: EDGE_NORMAL
    };
}

function compareEvent(a, b) {
    return (a.p[0] - b.p[0]) || (a.p[1] - b.p[1]) || (a.left === b.left ? below(a, b.other.p) : a.left ? 1 : -1);
}

function compareEdge(a, b) {
    return equals(a.p, b.p) ? below(a, b.other.p) : -below(b, a.p);
}

function below(e, p) {
    return e.left ? orient(e.p, e.other.p, p) : orient(e.other.p, e.p, p);
}

function equals(a, b) {
    var dx = b[0] - a[0],
        dy = b[1] - a[1];
    return dx * dx + dy * dy < sqrEpsilon;
}

function orient(a, b, c) {
    var acx = a[0] - c[0],
        bcx = b[0] - c[0],
        acy = a[1] - c[1],
        bcy = b[1] - c[1];
    return acx * bcy - acy * bcx >= 0 ? 1 : -1;
}

},{"tinyqueue":"/home/tcql/Code/turf-plugins/polyclip/node_modules/tinyqueue/index.js"}]},{},["/home/tcql/Code/turf-plugins/polyclip/polyclip.js"])("/home/tcql/Code/turf-plugins/polyclip/polyclip.js")
});