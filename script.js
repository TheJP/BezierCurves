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

    ctx.strokeStyle = 'lime';
    ctx.lineWidth = '5';
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.strokeRect(0, 0, window.innerWidth, window.innerHeight);

    // Gate off cache access until it is ready
    if (!cacheReady) {
        return;
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

    console.log(cache);

    cacheReady = true;
})();
