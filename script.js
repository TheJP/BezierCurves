"use strict";

/**
 * Rendering context of the main canvas.
 * @type {CanvasRenderingContext2D}
 */
var ctx = null;

/**
 * Dimension of the bezier curves.
 */
const n = 12;
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
 * Linear interpolation between the two given numbers.
 * @param {number} x Interpolation number 1.
 * @param {number} y Interpolation number 2.
 * @param {number} factor Interpolation factor in [0, 1] range (0=x, 1=y).
 */
function interpolate(x, y, factor) {
    return x + factor * (y - x);
}

/**
 * Variable that gates animation to prevent null-reference exceptions or
 * access of uninitialised cache.
 */
var cacheReady = false;

class Colour {
    /**
     * @param {number} r Red.
     * @param {number} g Green.
     * @param {number} b Blue.
     */
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    toCSS() { return `rgb(${this.r}, ${this.g}, ${this.b})`; }
    toCSSWithA(a) { return `rgba(${this.r}, ${this.g}, ${this.b}, ${a})`; }
    
    /**
     * Linear interpolation between this colour and the given other colour.
     * @param {Colour} other Colour to interpolate with.
     * @param {number} factor Interpolation factor in [0, 1] range (0=this colour, 1=the other colour).
     */
    interpolate(other, factor) {
        return new Colour(
            interpolate(this.r, other.r, factor),
            interpolate(this.g, other.g, factor),
            interpolate(this.b, other.b, factor));
    }
}

/**
 * Animation constants.
 */
const consts = {
    /**
     * How many milliseconds until a new curve is spawned.
     */
    newCurveMs: 800,
    /**
     * Amount of curves present at once.
     */
    maxCurves: 50,
    /**
     * Amount of line segments that are used per drawn curve.
     */
    numberOfSegments: 100,
    /**
     * Speed with which the curve points move on the [0, 1]^2 plane.
     */
    curveAnimationSpeed: 0.01,
    squaredCurveAnimationSpeed: 0,
    /**
     * Restrict movement per point further in the x direction.
     */
    maxSegmentPerPoint: 0.3,
    /**
     * How much the curve points are limited vertically.
     */
    verticalCompression: 0.35,
    /**
     * Speed with which the curves slide upwards vertically.
     */
    verticalSlideSpeed: 0.01,
    /**
     * Colurs to render the lines in.
     */
    colours: [
        new Colour(255, 0, 24), // red
        new Colour(255, 165, 44), // orange
        new Colour(255, 255, 65), // yellow
        new Colour(0, 128, 24), // green
        new Colour(0, 0, 249), // blue
        new Colour(134, 0, 125), // violet
    ],
}
consts.squaredCurveAnimationSpeed = consts.curveAnimationSpeed * consts.curveAnimationSpeed;

class Point {
    /**
     * @param {number} x X coordinate.
     * @param {number} y Y coordintate.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class AnimatedPoint {
    /**
     * @param {number} x X coordinate.
     * @param {number} y Y coordintate.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.stepX = 0;
        this.stepY = 0;
    }

    toPoint() { return new Point(this.x, this.y); }
}

/**
 * Inter frame variables.
 */
var vars = {
    lastFrame: 0,
    // Make sure a curve is spawned
    lastNewCurve: -consts.newCurveMs,
    /**
     * @type {Point[][]}
     */
    curves: [],
    /**
     * @type {AnimatedPoint[]}
     */
    mainCurve: [],
};

/**
 * Renders the given curve to the main canvas.
 * @param {Point[]} curve Curve to be rendered.
 * @param {(x: number) => number} transformX Function used to transfrom [0, 1] range to x coordinate.
 * @param {(y: number) => number} transformY Function used to transfrom [0, 1] range to y coordinate.
 */
function renderCurve(curve, transformX, transformY) {
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
}

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

    // Animate main curve
    for (let i = 0; i <= n; ++i) {
        const point = vars.mainCurve[i];
        const distanceX = point.targetX - point.x;
        const distanceY = point.targetY - point.y;
        if (distanceX * distanceX + distanceY * distanceY <= consts.squaredCurveAnimationSpeed && i !== 0 && i !== n) {
            // Choose new targets
            point.x = point.targetX;
            point.y = point.targetY;
            point.targetX = Math.random() * consts.maxSegmentPerPoint + (i / n) * (1 - consts.maxSegmentPerPoint);
            point.targetY = Math.random();
            const norm = Math.sqrt(point.targetX * point.targetX + point.targetY * point.targetY);
            point.stepX = (point.targetX - point.x) / norm;
            point.stepY = (point.targetY - point.y) / norm;
        } else {
            // Animate points with fixed speed towards target
            point.x += point.stepX * consts.squaredCurveAnimationSpeed * update;
            point.y += point.stepY * consts.squaredCurveAnimationSpeed * update;
            // Hotfix for the case that update is so big that the target is skipped
            if (Math.pow(point.targetX - point.x, 2) + Math.pow(point.targetY - point.y, 2) > distanceX * distanceX + distanceY * distanceY) {
                console.log(point.x, point.y, point.targetX, point.targetY);
                point.x = point.targetX;
                point.y = point.targetY;
            }
        }
    }

    // Create new curves
    if (timestamp - vars.lastNewCurve >= consts.newCurveMs) {
        vars.lastNewCurve = timestamp;
        const curve = [];
        for (const point of vars.mainCurve) {
            curve.push(point.toPoint());
        }
        vars.curves.push(curve);
    }

    // Remove curves until maximum is reached
    while (vars.curves.length > consts.maxCurves) {
        vars.curves.splice(0, 1);
    }

    // Render all curves
    const factorX = ctx.canvas.width;
    const factorY = consts.verticalCompression * ctx.canvas.height;
    let yTransform = 0;
    function transformX(x) { return x * factorX; }
    function transformY(y) {
        return (0.7 * ctx.canvas.height) + (factorY * (y - 0.5)) + yTransform;
    }

    ctx.lineWidth = '3';
    const yPerCurve = -consts.verticalSlideSpeed * ctx.canvas.height;
    ctx.strokeStyle = consts.colours[consts.colours.length - 1].toCSS();
    renderCurve(vars.mainCurve, transformX, transformY);
    const slideFactor = (timestamp - vars.lastNewCurve) / consts.newCurveMs;
    yTransform += yPerCurve * slideFactor;
    let colourIndex = 0;
    for (let i = vars.curves.length - 1; i >= 0; --i) {
        const nextColourIndex = Math.floor(consts.colours.length * ((i - 1) / consts.maxCurves));
        const colour = colourIndex === nextColourIndex ? consts.colours[colourIndex] :
            consts.colours[colourIndex].interpolate(consts.colours[nextColourIndex], slideFactor);
        colourIndex = nextColourIndex;
        ctx.strokeStyle = colour.toCSS();
        renderCurve(vars.curves[i], transformX, transformY);
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

    // Create main curve
    const xs = [0];
    for (let i = 1; i < n; ++i) {
        xs.push(Math.random());
    }
    xs.sort();
    vars.mainCurve.push(new AnimatedPoint(-0.1, 0.5));
    for (let i = 1; i < n; ++i) {
        vars.mainCurve.push(new AnimatedPoint(xs[i], Math.random()));
    }
    vars.mainCurve.push(new AnimatedPoint(1.1, 0.5));

    cacheReady = true;
})();
