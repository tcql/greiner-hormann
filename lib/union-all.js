/**
 * In some cases, it's very useful to be able to union all input rings
 * against eachother. This case should be avoided if possible, because
 * it will always be one of the slowest things to do (because every single
 * ring must be compared against every single other one!)
 *
 * This is for example used in `union` and `intersect` to join
 * all holes before subtracting them from output hulls
 */
