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
 * @type {Map<string, Colour[]>}
 */
const colourMap = new Map([
    ["lgbtqia+", [
        new Colour(255, 0, 24), // red
        new Colour(255, 165, 44), // orange
        new Colour(255, 255, 65), // yellow
        new Colour(0, 128, 24), // green
        new Colour(0, 0, 249), // blue
        new Colour(134, 0, 125), // violet
    ]],
    ["aromantic", [
        new Colour(58, 166, 63), // green
        new Colour(168, 212, 122), // light green
        new Colour(255, 255, 255), // white
        new Colour(170, 170, 170), // gray
        new Colour(0, 0, 0), // black
    ]],
    ["asexual", [
        new Colour(0, 0, 0), // black
        new Colour(164, 164, 164), // gray
        new Colour(255, 255, 255), // white
        new Colour(129, 0, 129), // violet
    ]],
    ["transgender", [
        new Colour(85, 205, 252), // light blue
        new Colour(247, 168, 184), // pink
        new Colour(255, 255, 255), // white
        new Colour(247, 168, 184), // pink
        new Colour(85, 205, 252), // light blue
    ]],
    ["non-binary", [
        new Colour(255, 244, 48), // yellow
        new Colour(255, 255, 255), // white
        new Colour(156, 89, 209), // violet
        new Colour(0, 0, 0), // black
    ]],
    ["bisexual", [
        new Colour(214, 2, 112), // purple
        new Colour(155, 79, 150), // violet
        new Colour(0, 56, 168), // blue
    ]],
    ["intersex", [
        new Colour(255, 218, 0), // yellow
        new Colour(122, 0, 172), // violet
    ]],
    ["pansexual", [
        new Colour(255, 27, 141), // pink
        new Colour(255, 218, 0), // pink
        new Colour(27, 179, 255), // light blue
    ]],
    ["lesbian", [
        new Colour(214, 41, 0), // red
        new Colour(255, 155, 85), // orange
        new Colour(255, 255, 255), // white
        new Colour(212, 97, 166), // pink
        new Colour(165, 0, 98), // dark pink
    ]],

]);
const colourIndices = Array.from(colourMap.keys());
let currentColoursIndex = 0;

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
    /**
     * Used to disable rendering during warmup phase.
     */
    enableRendering: false,
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
 * Animate the control points of the given curve.
 * @param {AnimatedPoint[]} curve Curve to be animated.
 * @param {number} update Milliseconds since the last update.
 */
function animateCurve(curve, update) {
    for (let i = 0; i <= n; ++i) {
        const point = curve[i];
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
}

/**
 * Animate the main canvas.
 * @param {number} timestamp Time at which the drawing function was called.
 */
function canvasDrawFrame(timestamp) {
    const update = timestamp - vars.lastFrame;
    vars.lastFrame = timestamp;

    // Gate off cache access until it is ready
    if (!cacheReady) {
        return;
    }

    // Animate main curve
    animateCurve(vars.mainCurve, update);

    // Create new curves
    if (timestamp - vars.lastNewCurve >= consts.newCurveMs) {
        vars.lastNewCurve = timestamp;
        vars.curves.push(vars.mainCurve.map(x => x.toPoint()));
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

    // Gate off rendering of canvas
    if (!vars.enableRendering) {
        return;
    }
    // No state updates beyond this point!

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.lineWidth = '3';
    const colours = colourMap.get(colourIndices[currentColoursIndex]);
    const yPerCurve = -consts.verticalSlideSpeed * ctx.canvas.height;
    const slideFactor = (timestamp - vars.lastNewCurve) / consts.newCurveMs;
    yTransform += yPerCurve * (vars.curves.length - 1) + yPerCurve * slideFactor;
    let colourIndex = 0;
    for (let i = 0; i < vars.curves.length; ++i) {
        // Determine colour of curve
        let colour = colours[colourIndex];
        const nextColourIndex = Math.floor(colours.length * (i / consts.maxCurves));
        if (colourIndex !== nextColourIndex) {
            // Interpolate correct colour for curve
            colour = colours[nextColourIndex].interpolate(colours[colourIndex], slideFactor);
            colourIndex = nextColourIndex;
        }
        ctx.strokeStyle = colour.toCSS();
        // Fade out top line
        if (i == 0) {
            ctx.strokeStyle = colours[0].toCSSWithA(1 - slideFactor);
        }
        renderCurve(vars.curves[i], transformX, transformY);
        yTransform -= yPerCurve;
    }

    // Render main curve
    yTransform = 0;
    ctx.strokeStyle = colours[colours.length - 1].toCSS();
    renderCurve(vars.mainCurve, transformX, transformY);
}

/**
 * Creates a loop for continuous rendering.
 * @param {number} warmup Milliseconds to prerender.
 */
function createRenderingLoop(warmup) {
    vars.lastFrame = -16;
    let artificialTimestamp = 0;
    for(; artificialTimestamp <= warmup; artificialTimestamp += 16) {
        canvasDrawFrame(artificialTimestamp);
    }

    let firstRealTimestamp = 0;
    function renderFrame(timestamp) {
        window.requestAnimationFrame(renderFrame);
        if (firstRealTimestamp === 0) {
            firstRealTimestamp = timestamp;
        } else {
            canvasDrawFrame(artificialTimestamp + (timestamp - firstRealTimestamp));
        }
    }

    vars.enableRendering = true;
    window.requestAnimationFrame(renderFrame);
}

function onCanvasClicked() {
    currentColoursIndex = (currentColoursIndex + 1) % colourIndices.length;
}

// Start animation when 
window.addEventListener("load", function onWindowLoad() {
    const canvas = window.document.getElementById("canvas");
    canvas.addEventListener("click", onCanvasClicked);
    ctx = canvas.getContext("2d");

    // Resize canvas correctly
    function onWindowResize() {
        ctx.canvas.width = window.innerWidth;
        ctx.canvas.height = window.innerHeight;
    }
    onWindowResize();
    window.addEventListener("resize", onWindowResize);

    // Start animation cycle
    createRenderingLoop(consts.maxCurves * consts.newCurveMs);
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
