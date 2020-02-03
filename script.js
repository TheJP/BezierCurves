"use strict";

/**
 * Rendering context of the main canvas.
 * @type {CanvasRenderingContext2D}
 */
var ctx = null;

/**
 * Dimension of the bezier curves.
 */
const n = 8;
var nEven = n % 2 === 0;

/**
 * Cache array for faster binomial calculation.
 * @type {number[]}
 */
var binomial = [];

const numberOfSegments = 100;

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
 * Variable that gates animation to prevent null-reference exceptions or
 * access of uninitialised cache.
 */
var cacheReady = false;

/**
 * Inter frame variables.
 */
var vars = {
    lastFrame: 0,
    lastNewCurve: 0,
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
    if (vars.lastFrame === 0) {
        window.requestAnimationFrame(canvasDrawFrame);
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

    ctx.strokeStyle = 'lime';
    ctx.lineWidth = '5';
    
    const factorX = ctx.canvas.width;
    const factorY = 0.4 * ctx.canvas.height;
    function transformX(x) { return x * factorX; }
    function transformY(y) {
        return (0.7 * ctx.canvas.height) + (factorY * (y - 0.5));
    }

    for (const curve of vars.curves) {
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        for (const {x, y} of curve) {
            ctx.strokeText("x", transformX(x), transformY(y));
        }
        ctx.beginPath();
        const moveBy = ctx.canvas.width / numberOfSegments;
        for (let k = 0; k <= numberOfSegments; ++k) {
            const t = k / numberOfSegments;
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
    }
    ctx.closePath();
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

    // tmp (n + 1 points for bezier curve)
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
