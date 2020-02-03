"use strict";

/**
 * Rendering context of the main canvas.
 * @type {CanvasRenderingContext2D}
 */
var ctx = null;

/**
 * Dimension of the bezier curves.
 */
const n = 10;
var nEven = n % 2 === 0;

/**
 * Cache array for faster binomial calculation.
 * @type {number[]}
 */
var binomial = [];

/**
 * Calculates n choose x, where n is the global constant and
 * x is the function parameter.
 * @param {number} x Binomial value to calculate (has to be integral).
 */
function getNChooseX(x) {
    if (x < 0 || x > n) { return 0; }
    return 2 * x <= n ? binomial[x] : binomial[n - x];
}

/**
 * Clamps the given number to given lower and upper bounds.
 * @param {number} x Value to be clamped.
 * @param {number} lower Lower bound.
 * @param {number} upper Upper bound.
 */
function clamp(x, lower, upper) {
    return Math.min(Math.max(x, lower), upper);
}

/**
 * Clamp the given value to a [0, 1] range.
 * @param {number} x Value to be clamped.
 */
function nclamp(x) {
    return Math.min(Math.max(x, 0), 1);
}

/**
 * Variable that gates animation to prevent null-reference exceptions or
 * access of uninitialised cache.
 */
var cacheReady = false;

/**
 * Animation constants.
 */
const consts = {
    /**
     * How many milliseconds until a new curve is spawned.
     */
    newCurveMs: 1000,
    /**
     * Amount of curves present at once.
     */
    maxCurves: 30,
    /**
     * Amount of line segments that are used per drawn curve.
     */
    numberOfSegments: 100,
    /**
     * Maximal amount that end points may move.
     */
    endPointsMaxVertical: 0.1,
    /**
     * Maximal amount that all other control points may move.
     */
    controlPointsMax: 0.2,
}

/**
 * Inter frame variables.
 */
var vars = {
    lastFrame: 0,
    // Make sure a curve is spawned
    lastNewCurve: -consts.newCurveMs,
    /**
     * @type {{x: number, y: number}[][]}
     */
    curves: [],
};

/**
 * Animate the main canvas.
 * @param {number} timestamp Time at which the drawing function was called.
 */
function canvasDrawFrame(timestamp) {
    // Setup frame
    window.requestAnimationFrame(canvasDrawFrame);
    if (vars.lastFrame === 0) {
        // Skip first frame to initialise vars.lastFrame
        vars.lastFrame = timestamp;
        return;
    }
    const update = timestamp - vars.lastFrame;
    vars.lastFrame = timestamp;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Gate off cache access until it is ready
    if (!cacheReady) {
        return;
    }

    if (timestamp - vars.lastNewCurve >= consts.newCurveMs) {
        vars.lastNewCurve = timestamp;
        const base = vars.curves[vars.curves.length - 1];
        const curve = [];
        curve.push({x: 0, y: nclamp(base[0].y + consts.endPointsMaxVertical * (Math.random() - 0.5))});
        for (let i = 1; i < n; ++i) {
            curve.push({
                x: nclamp(base[i].x + consts.controlPointsMax * (Math.random() - 0.5)),
                y: nclamp(base[i].y + consts.controlPointsMax * (Math.random() - 0.5))
            });
        }
        curve.push({x: 1, y: nclamp(base[base.length - 1].y + 0.1 * (Math.random() - 0.5))});
        vars.curves.push(curve);
    }

    // Remove curves until maximum is reached
    while (vars.curves.length > consts.maxCurves) {
        vars.curves.splice(0, 1);
    }

    // Render all curves
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = '2';
    
    const factorX = ctx.canvas.width;
    const factorY = 0.4 * ctx.canvas.height;
    let yTransform = 0;
    function transformX(x) { return x * factorX; }
    function transformY(y) {
        return (0.7 * ctx.canvas.height) + (factorY * (y - 0.5)) + yTransform;
    }

    const yPerCurve = (0.3 * ctx.canvas.height) / -consts.maxCurves;
    yTransform -= yPerCurve * ((timestamp - vars.lastNewCurve) / consts.newCurveMs);
    for (const curve of vars.curves) {
        // ctx.textBaseline = "middle";
        // ctx.textAlign = "center";
        // for (const {x, y} of curve) {
        //     ctx.strokeText("x", transformX(x), transformY(y));
        // }
        ctx.beginPath();
        const moveBy = ctx.canvas.width / consts.numberOfSegments;
        for (let k = 0; k <= consts.numberOfSegments; ++k) {
            const t = k / consts.numberOfSegments;
            let x = 0;
            let y = 0;
            for (let i = 0; i <= n; ++i) {
                const factor = getNChooseX(i) * Math.pow(1 - t, n - i) * Math.pow(t, i);
                x += factor * transformX(curve[i].x);
                y += factor * transformY(curve[i].y);
            }
            if (k == 0) { ctx.moveTo(x, y); }
            else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.closePath();
        yTransform += yPerCurve;
    }
}

// Start animation when 
window.addEventListener("load", function onWindowLoad() {
    const canvas = window.document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    // Resize canvas correctly
    function onWindowResize() {
        ctx.canvas.width = window.innerWidth;
        ctx.canvas.height = window.innerHeight;
    }
    onWindowResize();
    window.addEventListener("resize", onWindowResize);

    // Start animation cycle
    window.requestAnimationFrame(canvasDrawFrame);
});

// Cache calculations
(() => {
    // Calculate binomial lookup table using pascals triangle
    let cache = [1];
    let even = true;
    for (let i = 1; i <= n; ++i) {
        even = !even;
        let cache2 = [1];
        for (let j = 1; j < cache.length + (even ? 1 : 0); ++j) {
            if (j !== cache.length) {
                cache2.push(cache[j - 1] + cache[j]);
            } else {
                cache2.push(2 * cache[j - 1]);
            }
        }
        cache = cache2;
    }
    binomial = cache;

    // Create seeding curve
    const curve = [];
    const xs = [0];
    for (let i = 1; i < n; ++i) {
        xs.push(Math.random());
    }
    xs.push(1);
    xs.sort();
    for (let i = 0; i <= n; ++i) {
        curve.push({x: xs[i], y: Math.random()});
    }
    vars.curves.push(curve);

    cacheReady = true;
})();
