
function DebugViz(id, options) {
    var canvas = this.canvas = document.getElementById(id);
    var ctx = this.ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    canvas.width = window.innerWidth;
}

var padding = 5;

DebugViz.prototype = {
    scale: function (points) {
        var bbox = this._bbox = [Infinity, Infinity, -Infinity, -Infinity];
        this._extendBBox(points);

        var width = bbox[2] - bbox[0];
        var height = bbox[3] - bbox[1];

        this.canvas.height = this.canvas.width * height / width + padding * 2;
        this._ratio = (this.canvas.width - padding * 2) / width;

        this._setupRetina();
    },

    vertical: function (x, color) {
        this.ctx.strokeStyle = color;
        x = this._convert([x, 0])[0];
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
    },

    clear: function () {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    point: function (p, color) {
        p = this._convert(p);
        this.ctx.fillStyle = color || 'grey';
        this.ctx.fillRect(p[0] - 3, p[1] - 3, 6, 6);
        return this;
    },

    poly: function (points, color, fill) {
        var ctx = this.ctx;

        if (!points.length) return;

        ctx.beginPath();

        ctx.strokeStyle = color;
        if (fill) ctx.fillStyle = fill;

        this._path(points, fill);
        ctx.stroke();

        if (fill) ctx.fill('evenodd');
    },

    _path: function (points, fill) {
        if (Array.isArray(points[0][0])) {
            for (var i = 0; i < points.length; i++) this._path(points[i], fill);

        } else {
            var ctx = this.ctx;
            for (var i = 0; i < points.length; i++) {
                var p = this._convert(points[i]);
                if (i === 0) ctx.moveTo(p[0], p[1]);
                else ctx.lineTo(p[0], p[1]);
            }
            if (fill) ctx.closePath();
        }
    },

    _convert: function (p) {
        var x = (p[0] - this._bbox[0]) * this._ratio + padding,
            y = (p[1] - this._bbox[1]) * this._ratio + padding;
        return [x, y];
    },

    _extendBBox: function (points) {
        var bbox = this._bbox;
        if (!points.length) return;
        if (Array.isArray(points[0])) {
            for (var i = 0; i < points.length; i++) this._extendBBox(points[i]);
        } else {
            bbox[0] = Math.min(bbox[0], points[0]);
            bbox[1] = Math.min(bbox[1], points[1]);
            bbox[2] = Math.max(bbox[2], points[0]);
            bbox[3] = Math.max(bbox[3], points[1]);
        }
    },

    _setupRetina: function () {
        var canvas = this.canvas;

        if (devicePixelRatio > 1) {
            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px';
            canvas.width *= 2;
            canvas.height *= 2;
            this.ctx.scale(2, 2);
        }
    }
};
