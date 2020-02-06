"use strict";

// /**
//  * Animation constants.
//  */
// const consts = {
//     /**
//      * How many milliseconds until a new curve is spawned.
//      */
//     newCurveMs: 800,
//     /**
//      * Amount of curves present at once.
//      */
//     maxCurves: 50,
//     /**
//      * Amount of line segments that are used per drawn curve.
//      */
//     numberOfSegments: 100,
//     /**
//      * Speed with which the curve points move on the [0, 1]^2 plane.
//      */
//     curveAnimationSpeed: 0.01,
//     squaredCurveAnimationSpeed: 0,
//     /**
//      * Restrict movement per point further in the x direction.
//      */
//     maxSegmentPerPoint: 0.3,
//     /**
//      * How much the curve points are limited vertically.
//      */
//     verticalCompression: 0.35,
//     /**
//      * Speed with which the curves slide upwards vertically.
//      */
//     verticalSlideSpeed: 0.01,
// }
// consts.squaredCurveAnimationSpeed = consts.curveAnimationSpeed * consts.curveAnimationSpeed;

class Creator {
    /**
     * @param {HTMLElement} element Wrapped element.
     */
    constructor(element) { this.element = element; }

    append(child) {
        this.element.appendChild(child.element);
        return this;
    }
}

/**
 * @param {string} nodeName Name of the element.
 */
function create(nodeName) {
    return new Creator(document.createElement(nodeName));
}

window.addEventListener("load", function onWindowLoad() {
    const table = new Creator(document.getElementById("sliders-table"));

    function addSlider(text, initValue, min, max, step, onChange) {
        const label = create("label");
        label.element.textContent = text;
        const valueDisplay = create("th");
        valueDisplay.element.textContent = initValue.toString();
        const field = create("input");
        field.element.setAttribute("type", "range");
        field.element.setAttribute("min", min.toString());
        field.element.setAttribute("max", max.toString());
        field.element.setAttribute("step", step.toString());
        field.element.setAttribute("value", initValue.toString());
        field.element.addEventListener("change", () => {
            valueDisplay.element.textContent = field.element.value.toString();
            onChange(field.element.value)
        });
        table.append(create("tr")
            .append(create("th").append(label))
            .append(valueDisplay)
            .append(create("td").append(field)));
    }

    addSlider("Curve Count", consts.maxCurves, 0, 1000, 1, value => consts.maxCurves = value);
    addSlider("Curve Vertical Distance", consts.verticalSlideSpeed, 0, 0.5, 0.001, value => consts.verticalSlideSpeed = value);
    addSlider("[Speed] Curve Creation Intervall (ms)", consts.newCurveMs, 1, 5000, 1, value => consts.newCurveMs = value);
    addSlider("[Speed] Curve Animation", consts.curveAnimationSpeed, 0, 0.2, 0.001, value => {
        consts.curveAnimationSpeed = value;
        consts.squaredCurveAnimationSpeed = value * value;
    });
    addSlider("Curve Crazyness", consts.maxSegmentPerPoint, 0, 1, 0.01, value => consts.maxSegmentPerPoint = value);
    addSlider("Render Quality", consts.numberOfSegments, 1, 300, 1, value => consts.numberOfSegments = value);
    addSlider("Vertical Compression (% of height)", consts.verticalCompression, 0, 1, 0.01, value => consts.verticalCompression = value);
    addSlider("Curve Control Points", n, 1, 20, 1, value => recalculateCache(value));
});