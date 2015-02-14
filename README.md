# Greiner-Hormann Polygon Clipping

This is an experimental implementation of the Greiner-Hormann polygon clipping algorithm, with additional degeneracy handling.

**This is very unfinished and very likely to change!**

The end goal of this is to provide a base polygon clipping library that will support set-theoretic geometry operations for use in [TurfJs](https://github.com/turfjs/turf), as a replacement for the JSTS dependency.

### Benchmarks

Run `node bench`. This runs the same benchmark tests that `turf.intersect` had been using, since this is the major point of comparison to the prior JSTS implementation.

### Tests

Run `npm test`. This runs tests for `intersect` only. There are numerous tests for intersection cases, but most are commented out at the moment, since I've been frequently doing a lot of logging and hand checking on individual cases. I'm in the process of migrating to separate test files per exported method:

- `node test/union-test`
- `node test/intersect-test`
- `node test/util-test`


### Known Issues

- Intersecting identical geometries will produce an empty result
- Clipping anything other than two `Polygons` won't work (but polygons with holes are working)
- The `union` lib function signature is different than usual; for now it takes an array of polygons / multipolygons, rather than two geometries to union. This is convenience for internal use, so maybe I'll provide two versions of it in the future.
- The `subtract` lib doesn't work with holes at all
- Some of the code is pretty ugly


### Sources

- [Greiner-Hormann algorithm](http://davis.wpi.edu/~matt/courses/clipping/)
- [Degeneracy handling](http://arxiv-web3.library.cornell.edu/pdf/1211.3376v1.pdf)
- [Python Polyclip](https://github.com/helderco/univ-polyclip)
- [Python Polyclip + some degeneracy handling](https://github.com/karimbahgat/Pure-Python-Greiner-Hormann-Polygon-Clipping/)

