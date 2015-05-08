# Greiner-Hormann Polygon Clipping

This is an experimental implementation of the Greiner-Hormann polygon clipping algorithm, with additional degeneracy handling.

- **Support**
    - Supports holes
    - Supports multi-polygon inputs
- **Operations**
    - union
    - intersect
    - subtract
- **Relatively Stable** but may produce invalid results in some cases. This is because:
    - Degeneracy handling is not a fully answered question with GH
    - GH has no built in provision for clipping multiple polygons or dealing with holes

The end goal of this is to provide a base polygon clipping library that will support set-theoretic geometry operations for use in [TurfJs](https://github.com/turfjs/turf), as a replacement for the JSTS dependency.

### Benchmarks

```
node bench
```

### Tests

```
npm test
```

Tests cases for all operations as well as the built in utilities will be executed.


### Known Issues

- The current implementation **cannot** return lines or points, so some degenerate sets will simply return nothing.
- Needs some refactor
- Not fully optimized - decomposing clipping calls could be greatly improved using [cascade unions](http://blog.cleverelephant.ca/2009/01/must-faster-unions-in-postgis-14.html) and bounding box pre-checks


### Sources

- [Greiner-Hormann algorithm](http://davis.wpi.edu/~matt/courses/clipping/)
- [Degeneracy handling](http://arxiv-web3.library.cornell.edu/pdf/1211.3376v1.pdf) (*see notes*)
- [Python Polyclip](https://github.com/helderco/univ-polyclip)
- [Python Polyclip + some degeneracy handling](https://github.com/karimbahgat/Pure-Python-Greiner-Hormann-Polygon-Clipping/)

### Notes

- It's been noted that the [Degeneracy handling](http://arxiv-web3.library.cornell.edu/pdf/1211.3376v1.pdf) paper ("Clipping of Arbitrary Polygons with Degeneracies") has been withdrawn because it doesn't truly solve all cases it claims to. As such, I've deviated somewhat from it's recommendations, but in general I'm using the techniques (such as in/on/out Vertex labelling and intersection removal) described in the paper
