/**
 * ============================================================================
 * EXTRUDED ROUND CORNERS MAKER v2.0.0
 * Adobe After Effects Script & ScriptUI Dockable Panel
 * 
 * INSTALLATION:
 * -------------
 * In Adobe After Effects, go to:
 *   File > Scripts > Install ScriptUI Panel...
 * Select this file ("ExtrudedRoundCornersMaker.jsx"), then restart After Effects.
 * Access the tool from:
 *   Window > ExtrudedRoundCornersMaker.jsx
 * 
 * Reference Repository (2D Geometry):
 *   https://github.com/work2survive/AECustomRoundedRect
 * Planned Repository:
 *   https://github.com/work2survive/Extruded-Round-Corners-Maker
 * 
 * Compatibility: Adobe After Effects CC 2018 through CC 2026+ (All Languages)
 * Author:        work2survive & Antigravity
 * Version:       2.0.0
 * ============================================================================
 * 
 * COMPREHENSIVE ARCHITECTURAL DOCUMENTATION:
 * ------------------------------------------
 * This tool proceduralizes the creation of true 3D extruded rounded rectangles
 * inside native Adobe After Effects compositions without relying on third-party
 * plugins, external 3D software (Cinema 4D / Blender), or slow Ray-traced 3D
 * renderers. It operates purely within Classic 3D and Advanced 3D rendering
 * engines using vector shape layers, 3D affine matrix transformations, and
 * real-time expression drivers.
 * 
 * MATHEMATICAL FOUNDATIONS:
 * -------------------------
 * 1. 2D Geometry & Proportional Radius Clamping (W3C CSS Backgrounds & Borders Level 3):
 *    When custom corner radii exceed the rectangular dimensions, standard Bézier
 *    curves intersect and produce inverted self-crossing loops. This script
 *    applies the W3C CSS border-radius proportional scaling formula across all
 *    four corners:
 *        topSum    = rTL + rTR
 *        bottomSum = rBL + rBR
 *        leftSum   = rTL + rBL
 *        rightSum  = rTR + rBR
 *        f = min(1.0, W / topSum, W / bottomSum, H / leftSum, H / rightSum)
 *        rTL *= f; rTR *= f; rBR *= f; rBL *= f;
 *    The front and back cap shapes utilize an 8-point closed Bézier path with
 *    tangent factor kappa = (4/3) * (sqrt(2) - 1) =~ 0.5522847498307936.
 * 
 * 2. Extruded Corners via Segmented Square Strips & Z Anchor Point Displacement:
 *    Per the explicit engineering specification, each corner arc is subdivided
 *    into S square shape strips (min 6, max 15, default 6).
 *    Instead of relying on orientation properties or intermediate nested nulls:
 *      a. Each segment square is parented to the Master Controller.
 *      b. Its position [X, Y, Z] is placed directly at the center of that
 *         corner's radius [cx, cy, depth / 2].
 *      c. Its Anchor Point is displaced along the local Z axis by the negative
 *         apothem (inradius to chord midpoint):
 *             rChord = R * cos(delta / 2)
 *             Anchor Point = [0, 0, -rChord]
 *      d. The strip is rotated using X Rotation (90 deg) and Z Rotation (thetaDeg):
 *         - X Rotation = 90 deg flips the strip perpendicular to the XY plane
 *           so its height spans along the extrusion depth axis (world Z).
 *         - Z Rotation = thetaDeg aims the local Z axis along the radial normal
 *           vector [sin(theta), -cos(theta), 0] in the XY plane.
 *         - The -rChord displacement on Anchor Point pushes the square outward
 *           to the chord perimeter, perfectly tangent to the circular arc!
 *         - NO orientation properties are touched, preserving pure Euler rotation
 *           matrices for optimal AE performance.
 * 
 * 3. Dynamic Straight Corner Fallback:
 *    When any corner's rounding checkbox is toggled off (or animated to 0):
 *      a. Its segmented arc squares instantly set their opacity to 0%.
 *      b. The adjacent straight edge walls dynamically extend their span
 *         (since rCorner becomes 0) to meet at the sharp 90-degree corner vertex!
 * 
 * 4. Extrusion Depth (Positive & Negative Values):
 *    Continuous extrusion depth slider supports both positive and negative values.
 *    All cap positions, wall positions, and segment heights dynamically adapt
 *    without flipping normals or causing inverted faces.
 * 
 * 5. Fine Tuning & Anti-Clipping Controls:
 *    - Gap Tolerance (px): Adds an adjustable seam buffer to chord widths and
 *      wall lengths to eliminate GPU rasterization hairline gaps.
 *    - Edge to Sides Distance (px): Adjusts cap-to-edge separation to eliminate
 *      edge clipping at perpendicular 90-degree junctions.
 *    - Inner vs Outer Distance (px): Micro-separation between internal and
 *      external faces to eliminate coplanar Z-fighting.
 * 
 * 6. Shading & Colors:
 *    - Front Face: Dark Red (#8B0000)
 *    - Back Face: Dark Green (#006400)
 *    - Edge & Arc Strips: Blue (#1E88E5)
 *    - "Paint inner sides using edge color": Dynamically creates interior cap
 *      faces sharing the edge color.
 * 
 * 7. Real-Time Occlusion Culling:
 *    Calculates dot product between active camera view vector and face world
 *    normal vector: dot = vCam . nWorld. Non-visible backfaces are culled (opacity = 0)
 *    to maximize rendering speed.
 * 
 * 8. Debug Text Layers:
 *    Generates 3D text layers reading "front" and "back" aligned on the cap faces
 *    for effortless orientation verification.
 * ============================================================================
 */

(function (thisObj) {
    "use strict";

    // ========================================================================
    // GLOBAL CONSTANTS & IDENTITY
    // ========================================================================
    var SCRIPT_NAME = "Extruded Round Corners Maker";
    var SCRIPT_VERSION = "2.0.0";
    var GITHUB_REF_URL = "https://github.com/work2survive/AECustomRoundedRect";
    var GITHUB_REPO_URL = "https://github.com/work2survive/Extruded-Round-Corners-Maker";

    // Standard cubic Bézier constant for 90-degree circular arc approximation:
    // kappa = 4/3 * (sqrt(2) - 1) =~ 0.5522847498307936
    var KAPPA = 0.5522847498307936;


    // ========================================================================
    // COLOR HELPERS
    // ========================================================================

    /**
     * Converts a hex string (e.g. "#1E88E5" or "#FFF") to normalized RGBA [r, g, b, a] (0.0 to 1.0).
     * @param {string} hex - The hex color string.
     * @param {number} [alpha=1.0] - Optional opacity value between 0.0 and 1.0.
     * @returns {Array<number>} Array of 4 floats [r, g, b, a].
     */
    function hexToRgba(hex, alpha) {
        if (alpha === undefined) alpha = 1.0;
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var r = parseInt(hex.substring(0, 2), 16) / 255;
        var g = parseInt(hex.substring(2, 4), 16) / 255;
        var b = parseInt(hex.substring(4, 6), 16) / 255;
        return [r, g, b, alpha];
    }

    /**
     * Converts normalized RGBA array [r, g, b] (0.0 to 1.0) into an uppercase Hex string "#RRGGBB".
     * @param {Array<number>} rgba - Normalized RGBA array.
     * @returns {string} Hex color string.
     */
    function rgbaToHex(rgba) {
        var r = Math.round((rgba[0] || 0) * 255).toString(16);
        var g = Math.round((rgba[1] || 0) * 255).toString(16);
        var b = Math.round((rgba[2] || 0) * 255).toString(16);
        if (r.length === 1) r = "0" + r;
        if (g.length === 1) g = "0" + g;
        if (b.length === 1) b = "0" + b;
        return ("#" + r + g + b).toUpperCase();
    }


    // ========================================================================
    // REUSABLE EXPRESSION SNIPPETS
    // ========================================================================

    /**
     * Generates the universal corner radii evaluation snippet.
     * Evaluates Master Round switch, Link All Corners switch, per-corner toggles,
     * and applies W3C CSS proportional scaling to guarantee no self-intersections.
     * Uses property index (1) for localization safety across all AE languages.
     * @returns {string} The expression snippet code.
     */
    function getRadiiSnippet() {
        return [
            '// --- Universal Corner Radii Evaluation (W3C CSS Standard) ---',
            'var masterRound = true;',
            'try { masterRound = ctrl.effect("Round Corners")(1).value > 0; } catch(e) { masterRound = true; }',
            'var linkAll = false;',
            'try { linkAll = ctrl.effect("Link All Corners")(1).value > 0; } catch(e) { linkAll = false; }',
            '',
            'var isTL = masterRound;',
            'try { isTL = masterRound && (ctrl.effect("Round Top-Left")(1).value > 0); } catch(e) { isTL = masterRound; }',
            'var isTR = masterRound;',
            'try { isTR = masterRound && (linkAll ? isTL : (ctrl.effect("Round Top-Right")(1).value > 0)); } catch(e) { isTR = masterRound; }',
            'var isBR = masterRound;',
            'try { isBR = masterRound && (linkAll ? isTL : (ctrl.effect("Round Bottom-Right")(1).value > 0)); } catch(e) { isBR = masterRound; }',
            'var isBL = masterRound;',
            'try { isBL = masterRound && (linkAll ? isTL : (ctrl.effect("Round Bottom-Left")(1).value > 0)); } catch(e) { isBL = masterRound; }',
            '',
            'var rawTL = 200, rawTR = 100, rawBR = 50, rawBL = 25;',
            'try { rawTL = ctrl.effect("Radius Top-Left")(1).value; } catch(e) { rawTL = 200; }',
            'try { rawTR = ctrl.effect("Radius Top-Right")(1).value; } catch(e) { rawTR = rawTL; }',
            'try { rawBR = ctrl.effect("Radius Bottom-Right")(1).value; } catch(e) { rawBR = rawTL; }',
            'try { rawBL = ctrl.effect("Radius Bottom-Left")(1).value; } catch(e) { rawBL = rawTL; }',
            '',
            'var rTL = isTL ? Math.max(0, rawTL) : 0;',
            'var rTR = isTR ? Math.max(0, linkAll ? rTL : rawTR) : 0;',
            'var rBR = isBR ? Math.max(0, linkAll ? rTL : rawBR) : 0;',
            'var rBL = isBL ? Math.max(0, linkAll ? rTL : rawBL) : 0;',
            '',
            '// W3C Proportional Overlap Scaling (§5.5): prevent radii from exceeding dimensions',
            'var topSum    = rTL + rTR;',
            'var bottomSum = rBL + rBR;',
            'var leftSum   = rTL + rBL;',
            'var rightSum  = rTR + rBR;',
            'var fScale = 1.0;',
            'if (topSum > W && topSum > 0)       fScale = Math.min(fScale, W / topSum);',
            'if (bottomSum > W && bottomSum > 0) fScale = Math.min(fScale, W / bottomSum);',
            'if (leftSum > H && leftSum > 0)     fScale = Math.min(fScale, H / leftSum);',
            'if (rightSum > H && rightSum > 0)   fScale = Math.min(fScale, H / rightSum);',
            'rTL *= fScale;',
            'rTR *= fScale;',
            'rBR *= fScale;',
            'rBL *= fScale;'
        ].join('\n');
    }

    /**
     * Generates real-time occlusion culling snippet for performance optimization.
     * Computes dot product between world surface normal and vector to camera.
     * @param {string} localNormalVecStr - Local normal vector string, e.g. '[0, 0, 1]'.
     * @returns {string} The expression snippet code.
     */
    function getOcclusionSnippet(localNormalVecStr) {
        return [
            '// --- Real-Time Camera Occlusion Culling ---',
            'var isVisible = true;',
            'var doOcclude = false;',
            'try { doOcclude = ctrl.effect("Occlusion Culling")(1).value > 0; } catch(e) { doOcclude = false; }',
            'if (doOcclude) {',
            '    try {',
            '        var cam = thisComp.activeCamera;',
            '        var camPos = cam ? cam.toWorld([0, 0, 0]) : [thisComp.width / 2, thisComp.height / 2, -2000];',
            '        var layerCenter = toWorld(anchorPoint);',
            '        var vCam = [camPos[0] - layerCenter[0], camPos[1] - layerCenter[1], camPos[2] - layerCenter[2]];',
            '        var nWorld = toWorldVec(' + localNormalVecStr + ');',
            '        var dot = vCam[0] * nWorld[0] + vCam[1] * nWorld[1] + vCam[2] * nWorld[2];',
            '        isVisible = (dot >= 0);',
            '    } catch(err) {',
            '        isVisible = true;',
            '    }',
            '}'
        ].join('\n');
    }


    // ========================================================================
    // EXPRESSION TEMPLATES
    // ========================================================================
    var EXPRESSIONS = {

        /**
         * Dynamic Cap Path Expression (AECustomRoundedRect reference):
         * Generates an 8-point parametric Bézier closed contour centered at [0, 0].
         */
        capPath: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = 600, H = 300;',
            'try { W = Math.max(1, ctrl.effect("Width")(1).value); } catch(e) {}',
            'try { H = Math.max(1, ctrl.effect("Height")(1).value); } catch(e) {}',
            getRadiiSnippet(),
            '',
            'var K = ' + KAPPA.toFixed(10) + ';',
            'var halfW = W / 2;',
            'var halfH = H / 2;',
            'var xMin = -halfW;',
            'var xMax =  halfW;',
            'var yMin = -halfH;',
            'var yMax =  halfH;',
            '',
            '// 8 vertices arranged clockwise starting from top edge (matching AECustomRoundedRect)',
            'var points = [',
            '    [xMin + rTL, yMin],        // P0: Top edge, TL curve end',
            '    [xMax - rTR, yMin],        // P1: Top edge, TR curve start',
            '    [xMax, yMin + rTR],        // P2: Right edge, TR curve end',
            '    [xMax, yMax - rBR],        // P3: Right edge, BR curve start',
            '    [xMax - rBR, yMax],        // P4: Bottom edge, BR curve end',
            '    [xMin + rBL, yMax],        // P5: Bottom edge, BL curve start',
            '    [xMin, yMax - rBL],        // P6: Left edge, BL curve end',
            '    [xMin, yMin + rTL]         // P7: Left edge, TL curve start',
            '];',
            '',
            'var inTangents = [',
            '    [-rTL * K, 0],             // P0: receives TL curve from P7',
            '    [0, 0],                    // P1: straight line along top',
            '    [0, -rTR * K],             // P2: receives TR curve from P1',
            '    [0, 0],                    // P3: straight line along right',
            '    [rBR * K, 0],              // P4: receives BR curve from P3',
            '    [0, 0],                    // P5: straight line along bottom',
            '    [0, rBL * K],              // P6: receives BL curve from P5',
            '    [0, 0]                     // P7: straight line along left',
            '];',
            '',
            'var outTangents = [',
            '    [0, 0],                    // P0: straight line to P1',
            '    [rTR * K, 0],              // P1: outgoing curve towards P2',
            '    [0, 0],                    // P2: straight line to P3',
            '    [0, rBR * K],              // P3: outgoing curve towards P4',
            '    [0, 0],                    // P4: straight line to P5',
            '    [-rBL * K, 0],             // P5: outgoing curve towards P6',
            '    [0, 0],                    // P6: straight line to P7',
            '    [0, -rTL * K]              // P7: outgoing curve towards P0',
            '];',
            '',
            'createPath(points, inTangents, outTangents, true);'
        ].join('\n'),

        /**
         * Cap Position: Computes Z positioning with continuous negative extrusion support.
         */
        capPosition: function (isBack, isInner) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var edgeSidesDist = 0.2;',
                'try { edgeSidesDist = ctrl.effect("Edge to Sides Distance (px)")(1).value; } catch(e) {}',
                'var innerOuterDist = 0.1;',
                'try { innerOuterDist = ctrl.effect("Inner vs Outer Distance (px)")(1).value; } catch(e) {}',
                'var d = 60;',
                'try { d = ctrl.effect("Extrusion Depth")(1).value; } catch(e) {}',
                '',
                (isBack
                    ? (isInner
                        ? 'var baseZ = d + (d >= 0 ? edgeSidesDist - innerOuterDist : -edgeSidesDist + innerOuterDist);'
                        : 'var baseZ = d + (d >= 0 ? edgeSidesDist : -edgeSidesDist);')
                    : (isInner
                        ? 'var baseZ = (d >= 0 ? -edgeSidesDist + innerOuterDist : edgeSidesDist - innerOuterDist);'
                        : 'var baseZ = (d >= 0 ? -edgeSidesDist : edgeSidesDist);')),
                '[0, 0, baseZ];'
            ].join('\n');
        },

        /**
         * Cap Opacity Expression: Combines master extrusion switch with occlusion test.
         */
        capOpacity: function (isBack) {
            var normalStr = isBack ? '[0, 0, 1]' : '[0, 0, -1]';
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var isExt = true;',
                'try { isExt = ctrl.effect("Extruded")(1).value > 0; } catch(e) {}',
                (isBack ? 'if (!isExt) { 0; } else {' : '{'),
                getOcclusionSnippet(normalStr),
                '    isVisible ? 100 : 0;',
                '}'
            ].join('\n');
        },

        /**
         * Straight Edge Walls: Size Expression.
         * All 4 walls use unified [depth, span] format for consistent 3D orientation.
         */
        straightWallSize: function (edgeKey) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = 600, H = 300;',
                'try { W = Math.max(1, ctrl.effect("Width")(1).value); } catch(e) {}',
                'try { H = Math.max(1, ctrl.effect("Height")(1).value); } catch(e) {}',
                getRadiiSnippet(),
                'var seam = 0.5;',
                'try { seam = ctrl.effect("Gap Tolerance (px)")(1).value; } catch(e) {}',
                'var d = 60;',
                'try { d = Math.abs(ctrl.effect("Extrusion Depth")(1).value); } catch(e) {}',
                (edgeKey === "top"
                    ? 'var span = Math.max(0.1, W - rTL - rTR + seam); [Math.max(0.1, d), span];'
                    : edgeKey === "bottom"
                    ? 'var span = Math.max(0.1, W - rBL - rBR + seam); [Math.max(0.1, d), span];'
                    : edgeKey === "left"
                    ? 'var span = Math.max(0.1, H - rTL - rBL + seam); [Math.max(0.1, d), span];'
                    : 'var span = Math.max(0.1, H - rTR - rBR + seam); [Math.max(0.1, d), span];')
            ].join('\n');
        },

        /**
         * Straight Edge Walls: Position Expression.
         * Positions wall midpoint directly on the perimeter bounding edge.
         */
        straightWallPos: function (edgeKey) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = 600, H = 300;',
                'try { W = ctrl.effect("Width")(1).value; } catch(e) {}',
                'try { H = ctrl.effect("Height")(1).value; } catch(e) {}',
                getRadiiSnippet(),
                'var d = 60;',
                'try { d = ctrl.effect("Extrusion Depth")(1).value; } catch(e) {}',
                (edgeKey === "top"
                    ? '[(rTL - rTR) / 2, -H / 2, d / 2];'
                    : edgeKey === "bottom"
                    ? '[(rBL - rBR) / 2,  H / 2, d / 2];'
                    : edgeKey === "left"
                    ? '[-W / 2, (rTL - rBL) / 2, d / 2];'
                    : '[ W / 2, (rTR - rBR) / 2, d / 2];')
            ].join('\n');
        },

        /**
         * Straight Edge Walls: Opacity Expression.
         */
        straightWallOpacity: function () {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var isExt = true;',
                'try { isExt = ctrl.effect("Extruded")(1).value > 0; } catch(e) {}',
                'if (!isExt) { 0; } else {',
                getOcclusionSnippet('[0, 0, 1]'),
                '    isVisible ? 100 : 0;',
                '}'
            ].join('\n');
        },

        /**
         * Segmented Corner Arc Strip: Position Expression.
         * Directly sets position to the corner radius center [cx, cy, d/2] in Master Controller space!
         * Displacement to the chord perimeter is accomplished via the Z Anchor Point property!
         */
        cornerSegmentPos: function (cornerId) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = 600, H = 300;',
                'try { W = Math.max(1, ctrl.effect("Width")(1).value); } catch(e) {}',
                'try { H = Math.max(1, ctrl.effect("Height")(1).value); } catch(e) {}',
                getRadiiSnippet(),
                'var R = ' + (cornerId === 'TL' ? 'rTL' : cornerId === 'TR' ? 'rTR' : cornerId === 'BR' ? 'rBR' : 'rBL') + ';',
                'var d = 60;',
                'try { d = ctrl.effect("Extrusion Depth")(1).value; } catch(e) {}',
                'var cx = ' + (cornerId === 'TL' ? '-W/2 + R' : cornerId === 'TR' ? 'W/2 - R' : cornerId === 'BR' ? 'W/2 - R' : '-W/2 + R') + ';',
                'var cy = ' + (cornerId === 'TL' ? '-H/2 + R' : cornerId === 'TR' ? '-H/2 + R' : cornerId === 'BR' ? 'H/2 - R' : 'H/2 - R') + ';',
                '[cx, cy, d / 2];'
            ].join('\n');
        },

        /**
         * Segmented Corner Arc Strip: Anchor Point Expression.
         * Displaces the square strip along local Z axis by -rChord = -R * cos(delta/2).
         * This pushes the square strip exactly onto the circular arc chord!
         */
        cornerSegmentAnchor: function (cornerId, S) {
            var delta = (Math.PI / 2) / S;
            var rChordFactor = Math.cos(delta / 2);
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = 600, H = 300;',
                'try { W = Math.max(1, ctrl.effect("Width")(1).value); } catch(e) {}',
                'try { H = Math.max(1, ctrl.effect("Height")(1).value); } catch(e) {}',
                getRadiiSnippet(),
                'var R = ' + (cornerId === 'TL' ? 'rTL' : cornerId === 'TR' ? 'rTR' : cornerId === 'BR' ? 'rBR' : 'rBL') + ';',
                'var rChord = R * ' + rChordFactor.toFixed(8) + ';',
                '[0, 0, -rChord];'
            ].join('\n');
        },

        /**
         * Segmented Corner Arc Strip: Rectangle Size Expression.
         * Width matches chord length 2 * R * sin(delta/2) + gapTolerance.
         * Height matches extrusion depth Math.abs(d).
         */
        cornerSegmentSize: function (cornerId, S) {
            var delta = (Math.PI / 2) / S;
            var sinFactor = 2 * Math.sin(delta / 2);
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = 600, H = 300;',
                'try { W = Math.max(1, ctrl.effect("Width")(1).value); } catch(e) {}',
                'try { H = Math.max(1, ctrl.effect("Height")(1).value); } catch(e) {}',
                getRadiiSnippet(),
                'var R = ' + (cornerId === 'TL' ? 'rTL' : cornerId === 'TR' ? 'rTR' : cornerId === 'BR' ? 'rBR' : 'rBL') + ';',
                'var seam = 0.5;',
                'try { seam = ctrl.effect("Gap Tolerance (px)")(1).value; } catch(e) {}',
                'var d = 60;',
                'try { d = Math.abs(ctrl.effect("Extrusion Depth")(1).value); } catch(e) {}',
                'var chordW = (R > 0.1) ? (R * ' + sinFactor.toFixed(8) + ' + seam) : 0.001;',
                '[Math.max(0.1, chordW), Math.max(0.1, d)];'
            ].join('\n');
        },

        /**
         * Segmented Corner Arc Strip: Opacity Expression.
         * When this corner is unchecked ("not rounded"), this expression instantly hides
         * the segment strips (0% opacity) so the straight walls cleanly meet at 90 degrees!
         */
        cornerSegmentOpacity: function (cornerId) {
            var cornerRoundCheck = (cornerId === "TL" ? 'isTL' : cornerId === "TR" ? 'isTR' : cornerId === "BR" ? 'isBR' : 'isBL');
            var cornerRadius = (cornerId === "TL" ? 'rTL' : cornerId === "TR" ? 'rTR' : cornerId === "BR" ? 'rBR' : 'rBL');
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var isExt = true;',
                'try { isExt = ctrl.effect("Extruded")(1).value > 0; } catch(e) {}',
                'var W = 600, H = 300;',
                'try { W = Math.max(1, ctrl.effect("Width")(1).value); } catch(e) {}',
                'try { H = Math.max(1, ctrl.effect("Height")(1).value); } catch(e) {}',
                getRadiiSnippet(),
                'var isRound = ' + cornerRoundCheck + ';',
                'var R = ' + cornerRadius + ';',
                'if (!isExt || !isRound || R < 0.1) {',
                '    0;',
                '} else {',
                getOcclusionSnippet('[0, 0, 1]'),
                '    isVisible ? 100 : 0;',
                '}'
            ].join('\n');
        },

        /**
         * Segmented Corner Arc Strip: Color Expression with subtle cylindrical shading.
         */
        cornerSegmentColor: function (thetaRad) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var baseCol = [0.12, 0.53, 0.90, 1];',
                'try { baseCol = ctrl.effect("Edge Color")(1).value; } catch(e) {}',
                'var shd = 0.15;',
                'try { shd = ctrl.effect("Shading Intensity")(1).value / 100; } catch(e) {}',
                'var light = 1 - Math.cos(' + thetaRad.toFixed(8) + ') * shd * 0.5;',
                'light = Math.max(0.15, Math.min(1.4, light));',
                '[baseCol[0] * light, baseCol[1] * light, baseCol[2] * light, baseCol[3]];'
            ].join('\n');
        }
    };


    // ========================================================================
    // RIG BUILDER ENGINE
    // ========================================================================

    /**
     * Constructs the complete 2D / 3D Extruded Round Corners rig inside Adobe After Effects.
     * @param {Object} params - User configuration parameter map.
     */
    function buildExtrusionRig(params) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please open or select an active composition first.", SCRIPT_NAME);
            return null;
        }

        app.beginUndoGroup("Build Extruded Round Corners v2.0.0");

        try {
            var targetComp = comp;
            var masterCompLayer = null;

            // Target precomp container option for pristine project cleanliness
            if (params.targetMode === "precomp") {
                var precompName = "Extruded_Round_Corners_" + (app.project.numItems + 1);
                var precomp = app.project.items.addComp(
                    precompName,
                    comp.width,
                    comp.height,
                    comp.pixelAspect,
                    comp.duration,
                    comp.frameRate
                );
                masterCompLayer = comp.layers.add(precomp);
                masterCompLayer.threeDLayer = true;
                masterCompLayer.collapseTransformation = true;
                targetComp = precomp;
            }

            // ----------------------------------------------------------------
            // 1. MASTER CONTROLLER (3D NULL WITH ALL TIMELINE CONTROLS)
            // ----------------------------------------------------------------
            var ctrl = targetComp.layers.addNull();
            ctrl.name = "Master Controller";
            ctrl.threeDLayer = true;
            ctrl.position.setValue([targetComp.width / 2, targetComp.height / 2, 0]);

            var fx = ctrl.property("ADBE Effect Parade");

            // Master Extruded Toggle
            var fxExtruded = fx.addProperty("ADBE Checkbox Control");
            fxExtruded.name = "Extruded";
            fxExtruded.property(1).setValue(params.isExtruded ? 1 : 0);

            // 2D Dimensions
            var fxWidth = fx.addProperty("ADBE Slider Control");
            fxWidth.name = "Width";
            fxWidth.property(1).setValue(params.width);

            var fxHeight = fx.addProperty("ADBE Slider Control");
            fxHeight.name = "Height";
            fxHeight.property(1).setValue(params.height);

            // Master & Link Corner Switches
            var fxRoundCorners = fx.addProperty("ADBE Checkbox Control");
            fxRoundCorners.name = "Round Corners";
            fxRoundCorners.property(1).setValue(params.roundCornersMaster ? 1 : 0);

            var fxLink = fx.addProperty("ADBE Checkbox Control");
            fxLink.name = "Link All Corners";
            fxLink.property(1).setValue(params.linkCorners ? 1 : 0);

            // Per-Corner Checkboxes & Radii Sliders (100% Animatable in AE Timeline)
            var fxRoundTL = fx.addProperty("ADBE Checkbox Control");
            fxRoundTL.name = "Round Top-Left";
            fxRoundTL.property(1).setValue(params.roundTL ? 1 : 0);

            var fxRadTL = fx.addProperty("ADBE Slider Control");
            fxRadTL.name = "Radius Top-Left";
            fxRadTL.property(1).setValue(params.radiusTL);

            var fxRoundTR = fx.addProperty("ADBE Checkbox Control");
            fxRoundTR.name = "Round Top-Right";
            fxRoundTR.property(1).setValue(params.roundTR ? 1 : 0);

            var fxRadTR = fx.addProperty("ADBE Slider Control");
            fxRadTR.name = "Radius Top-Right";
            fxRadTR.property(1).setValue(params.radiusTR);

            var fxRoundBR = fx.addProperty("ADBE Checkbox Control");
            fxRoundBR.name = "Round Bottom-Right";
            fxRoundBR.property(1).setValue(params.roundBR ? 1 : 0);

            var fxRadBR = fx.addProperty("ADBE Slider Control");
            fxRadBR.name = "Radius Bottom-Right";
            fxRadBR.property(1).setValue(params.radiusBR);

            var fxRoundBL = fx.addProperty("ADBE Checkbox Control");
            fxRoundBL.name = "Round Bottom-Left";
            fxRoundBL.property(1).setValue(params.roundBL ? 1 : 0);

            var fxRadBL = fx.addProperty("ADBE Slider Control");
            fxRadBL.name = "Radius Bottom-Left";
            fxRadBL.property(1).setValue(params.radiusBL);

            // Extrusion Depth (Supports Negative Values)
            var fxDepth = fx.addProperty("ADBE Slider Control");
            fxDepth.name = "Extrusion Depth";
            fxDepth.property(1).setValue(params.depth);

            // Color Controls
            var fxColFront = fx.addProperty("ADBE Color Control");
            fxColFront.name = "Front Cap Color";
            fxColFront.property(1).setValue(params.capFrontColor);

            var fxColBack = fx.addProperty("ADBE Color Control");
            fxColBack.name = "Back Cap Color";
            fxColBack.property(1).setValue(params.capBackColor);

            var fxColEdge = fx.addProperty("ADBE Color Control");
            fxColEdge.name = "Edge Color";
            fxColEdge.property(1).setValue(params.edgeColor);

            var fxPaintInner = fx.addProperty("ADBE Checkbox Control");
            fxPaintInner.name = "Paint Inner Sides Using Edge Color";
            fxPaintInner.property(1).setValue(params.paintInnerSides ? 1 : 0);

            // Fine Tuning & Tolerances
            var fxGapTol = fx.addProperty("ADBE Slider Control");
            fxGapTol.name = "Gap Tolerance (px)";
            fxGapTol.property(1).setValue(params.gapTolerance);

            var fxEdgeSidesDist = fx.addProperty("ADBE Slider Control");
            fxEdgeSidesDist.name = "Edge to Sides Distance (px)";
            fxEdgeSidesDist.property(1).setValue(params.edgeSidesDistance);

            var fxInnerOuterDist = fx.addProperty("ADBE Slider Control");
            fxInnerOuterDist.name = "Inner vs Outer Distance (px)";
            fxInnerOuterDist.property(1).setValue(params.innerOuterDistance);

            var fxShading = fx.addProperty("ADBE Slider Control");
            fxShading.name = "Shading Intensity";
            fxShading.property(1).setValue(params.shading);

            var fxOcclusion = fx.addProperty("ADBE Checkbox Control");
            fxOcclusion.name = "Occlusion Culling";
            fxOcclusion.property(1).setValue(params.occlusionCulling ? 1 : 0);


            // ----------------------------------------------------------------
            // 2. FRONT & BACK CAPS (OUTER & INNER FACES)
            // ----------------------------------------------------------------
            function createCapLayer(name, isBack, isInner) {
                var cap = targetComp.layers.addShape();
                cap.name = name;
                cap.threeDLayer = true;
                cap.parent = ctrl;
                cap.shy = isInner ? params.shySecondary : false;

                // Position expression tracking extrusion depth & anti-clipping offsets
                cap.property("ADBE Transform Group").property("ADBE Position").expression =
                    EXPRESSIONS.capPosition(isBack, isInner);

                // Opacity expression with real-time occlusion culling
                cap.property("ADBE Transform Group").property("ADBE Opacity").expression =
                    EXPRESSIONS.capOpacity(isBack);

                var contents = cap.property("ADBE Root Vectors Group");
                var group = contents.addProperty("ADBE Vector Group");
                group.name = "Cap Vectors";
                var gVecs = group.property("ADBE Vectors Group");

                var shapePath = gVecs.addProperty("ADBE Vector Shape - Group");
                shapePath.name = "Custom Rounded Path";
                shapePath.property("ADBE Vector Shape").expression = EXPRESSIONS.capPath;

                var fill = gVecs.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Cap Fill";

                if (isInner) {
                    fill.property("ADBE Vector Fill Color").expression = [
                        'var ctrl = thisComp.layer("Master Controller");',
                        'var useEdge = true;',
                        'try { useEdge = ctrl.effect("Paint Inner Sides Using Edge Color")(1).value > 0; } catch(e) {}',
                        'useEdge ? ctrl.effect("Edge Color")(1).value : ctrl.effect("' + (isBack ? "Back Cap Color" : "Front Cap Color") + '")(1).value;'
                    ].join('\n');
                } else {
                    fill.property("ADBE Vector Fill Color").expression =
                        'thisComp.layer("Master Controller").effect("' + (isBack ? "Back Cap Color" : "Front Cap Color") + '")(1).value;';
                }

                return cap;
            }

            // Create inner caps first, then outer caps so outer caps naturally render on top
            var capFrontInner = createCapLayer("Cap Front Inner", false, true);
            var capFront      = createCapLayer("Cap Front", false, false);
            var capBackInner  = createCapLayer("Cap Back Inner", true, true);
            var capBack       = createCapLayer("Cap Back", true, false);


            // ----------------------------------------------------------------
            // 3. DEBUG LABELS ("front" & "back")
            // ----------------------------------------------------------------
            if (params.showDebugLabels) {
                // Front Debug Text
                var frontText = targetComp.layers.addText("front");
                frontText.name = "DEBUG: front";
                frontText.threeDLayer = true;
                frontText.parent = ctrl;
                frontText.shy = params.shySecondary;

                var fTextProp = frontText.property("ADBE Text Properties").property("ADBE Text Document");
                var fTextDoc = fTextProp.value;
                fTextDoc.fontSize = 48;
                fTextDoc.fillColor = [1, 1, 1];
                fTextDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                fTextProp.setValue(fTextDoc);

                frontText.property("ADBE Transform Group").property("ADBE Position").expression = [
                    'var ctrl = thisComp.layer("Master Controller");',
                    'var edgeSidesDist = 0.2;',
                    'try { edgeSidesDist = ctrl.effect("Edge to Sides Distance (px)")(1).value; } catch(e) {}',
                    'var d = 60;',
                    'try { d = ctrl.effect("Extrusion Depth")(1).value; } catch(e) {}',
                    '[0, 16, (d >= 0 ? -edgeSidesDist - 0.5 : edgeSidesDist + 0.5)];'
                ].join('\n');

                // Back Debug Text (Rotated 180° around Y to read correctly from back)
                var backText = targetComp.layers.addText("back");
                backText.name = "DEBUG: back";
                backText.threeDLayer = true;
                backText.parent = ctrl;
                backText.shy = params.shySecondary;

                var bTextProp = backText.property("ADBE Text Properties").property("ADBE Text Document");
                var bTextDoc = bTextProp.value;
                bTextDoc.fontSize = 48;
                bTextDoc.fillColor = [1, 1, 1];
                bTextDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                bTextProp.setValue(bTextDoc);

                backText.property("ADBE Transform Group").property("ADBE Rotate Y").setValue(180);
                backText.property("ADBE Transform Group").property("ADBE Position").expression = [
                    'var ctrl = thisComp.layer("Master Controller");',
                    'var edgeSidesDist = 0.2;',
                    'try { edgeSidesDist = ctrl.effect("Edge to Sides Distance (px)")(1).value; } catch(e) {}',
                    'var d = 60;',
                    'try { d = ctrl.effect("Extrusion Depth")(1).value; } catch(e) {}',
                    '[0, 16, d + (d >= 0 ? edgeSidesDist + 0.5 : -edgeSidesDist - 0.5)];'
                ].join('\n');
            }


            // ----------------------------------------------------------------
            // 4. STRAIGHT EDGE WALLS (TOP, RIGHT, BOTTOM, LEFT)
            // ----------------------------------------------------------------
            function createStraightWall(name, edgeKey, rotX, rotY, rotZ) {
                var wall = targetComp.layers.addShape();
                wall.name = name;
                wall.threeDLayer = true;
                wall.parent = ctrl;
                wall.shy = params.shySecondary;

                var tr = wall.property("ADBE Transform Group");
                tr.property("ADBE Position").expression = EXPRESSIONS.straightWallPos(edgeKey);
                tr.property("ADBE Anchor Point").setValue([0, 0, 0]);
                tr.property("ADBE Rotate X").setValue(rotX);
                tr.property("ADBE Rotate Y").setValue(rotY);
                tr.property("ADBE Rotate Z").setValue(rotZ);
                tr.property("ADBE Opacity").expression = EXPRESSIONS.straightWallOpacity();

                var contents = wall.property("ADBE Root Vectors Group");
                var group = contents.addProperty("ADBE Vector Group");
                var gVecs = group.property("ADBE Vectors Group");

                var rect = gVecs.addProperty("ADBE Vector Shape - Rect");
                rect.name = "Wall Rect";
                rect.property("ADBE Vector Rect Size").expression = EXPRESSIONS.straightWallSize(edgeKey);

                var fill = gVecs.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Wall Fill";
                fill.property("ADBE Vector Fill Color").expression =
                    'thisComp.layer("Master Controller").effect("Edge Color")(1).value;';

                return wall;
            }

            // Unified 3D Wall Orientations (All 4 walls use Rotate X = 0 for rock-solid stability):
            // Top wall: rotY = 90, rotZ = -90 (lies in XZ plane at Y = -H/2, normal UP)
            // Bottom wall: rotY = 90, rotZ = 90 (lies in XZ plane at Y = H/2, normal DOWN)
            // Right wall: rotY = 90, rotZ = 0 (lies in YZ plane at X = W/2, normal RIGHT)
            // Left wall: rotY = -90, rotZ = 0 (lies in YZ plane at X = -W/2, normal LEFT)
            createStraightWall("Wall Top",    "top",    0,  90, -90);
            createStraightWall("Wall Bottom", "bottom", 0,  90,  90);
            createStraightWall("Wall Right",  "right",  0,  90,   0);
            createStraightWall("Wall Left",   "left",   0, -90,   0);


            // ----------------------------------------------------------------
            // 5. EXTRUDED CORNER ARCS (SEGMENTED SQUARE STRIPS VIA Z ANCHOR DISPLACEMENT)
            // ----------------------------------------------------------------
            // Strict user requirement:
            // "To build the segmented archs/corners, set the center of the segments/squares
            // in the center of the corner radius, but displace the squares using the Z anchor
            // point distance, and rotation values. (dont use the orientation prooperties)"
            var S = Math.max(6, Math.min(15, params.segments));
            var corners = [
                { id: "TR", name: "Top-Right",    startAngle: 0 },
                { id: "BR", name: "Bottom-Right", startAngle: Math.PI / 2 },
                { id: "BL", name: "Bottom-Left",  startAngle: Math.PI },
                { id: "TL", name: "Top-Left",     startAngle: 3 * Math.PI / 2 }
            ];

            var delta = (Math.PI / 2) / S;

            for (var c = 0; c < corners.length; c++) {
                var cornerInfo = corners[c];
                var cId = cornerInfo.id;

                for (var k = 0; k < S; k++) {
                    var thetaRad = cornerInfo.startAngle + (k + 0.5) * delta;
                    var thetaDeg = thetaRad * 180 / Math.PI;

                    var segLayer = targetComp.layers.addShape();
                    segLayer.name = "Arc " + cId + " [" + (k + 1) + "]";
                    segLayer.threeDLayer = true;
                    segLayer.parent = ctrl;
                    segLayer.shy = params.shySecondary;

                    var segTr = segLayer.property("ADBE Transform Group");

                    // 1. Position expression sets center of square directly at corner radius center:
                    segTr.property("ADBE Position").expression = EXPRESSIONS.cornerSegmentPos(cId);

                    // 2. Anchor point expression displaces square by negative chord distance in Z:
                    segTr.property("ADBE Anchor Point").expression = EXPRESSIONS.cornerSegmentAnchor(cId, S);

                    // 3. Rotation values: Rotate X = 90 deg, Rotate Z = thetaDeg (No orientation properties!)
                    segTr.property("ADBE Rotate X").setValue(90);
                    segTr.property("ADBE Rotate Y").setValue(0);
                    segTr.property("ADBE Rotate Z").setValue(thetaDeg);

                    // 4. Opacity expression automatically hides segment when corner is not rounded
                    segTr.property("ADBE Opacity").expression = EXPRESSIONS.cornerSegmentOpacity(cId);

                    var segContents = segLayer.property("ADBE Root Vectors Group");
                    var segGroup = segContents.addProperty("ADBE Vector Group");
                    var segVecs = segGroup.property("ADBE Vectors Group");

                    var segRect = segVecs.addProperty("ADBE Vector Shape - Rect");
                    segRect.name = "Segment Rect";
                    segRect.property("ADBE Vector Rect Size").expression =
                        EXPRESSIONS.cornerSegmentSize(cId, S);

                    var segFill = segVecs.addProperty("ADBE Vector Graphic - Fill");
                    segFill.name = "Segment Fill";
                    segFill.property("ADBE Vector Fill Color").expression =
                        EXPRESSIONS.cornerSegmentColor(thetaRad);
                }
            }


            // ----------------------------------------------------------------
            // 6. FINALIZE LAYER STACK & SELECTION
            // ----------------------------------------------------------------
            ctrl.moveToBeginning();
            targetComp.hideShyLayers = params.shySecondary;

            // Select master controller for immediate user convenience
            for (var i = 1; i <= targetComp.numLayers; i++) {
                targetComp.layer(i).selected = false;
            }
            ctrl.selected = true;

        } catch (err) {
            alert("Error building rig: " + err.toString(), SCRIPT_NAME);
        } finally {
            app.endUndoGroup();
        }
    }


    // ========================================================================
    // SCRIPTUI USER INTERFACE PANEL
    // ========================================================================
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " v" + SCRIPT_VERSION, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // Header Title & Version Information
        var headerGrp = win.add("group");
        headerGrp.orientation = "row";
        headerGrp.alignChildren = ["left", "center"];

        var titleTxt = headerGrp.add("statictext", undefined, SCRIPT_NAME);
        titleTxt.graphics.font = ScriptUI.newFont("sans-serif", "bold", 13);

        var verTxt = headerGrp.add("statictext", undefined, "v" + SCRIPT_VERSION);
        verTxt.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.45, 0.45, 0.45, 1], 1);

        var tabPnl = win.add("tabbedpanel");
        tabPnl.alignChildren = ["fill", "fill"];


        // ====================================================================
        // TAB 1: 2D GEOMETRY
        // ====================================================================
        var tabGeom = tabPnl.add("tab", undefined, "2D Geometry");
        tabGeom.alignChildren = ["fill", "top"];
        tabGeom.spacing = 6;

        // Preset Pulldown
        var presetGrp = tabGeom.add("group");
        presetGrp.add("statictext", undefined, "Size Preset:");
        var presetList = presetGrp.add("dropdownlist", undefined, [
            "Custom (600 x 300)",
            "Square (1080 x 1080)",
            "16:9 (1080p - 1920 x 1080)",
            "4:3 (1440 x 1080)",
            "2:1 (1920 x 960)",
            "Credit Card (856 x 540)"
        ]);
        presetList.selection = 0;

        // Dimensions Group (Default: 600 x 300)
        var dimPnl = tabGeom.add("panel", undefined, "Dimensions (px)");
        dimPnl.alignChildren = ["fill", "top"];
        dimPnl.spacing = 4;

        var wGrp = dimPnl.add("group");
        wGrp.add("statictext", undefined, "Width:").characters = 9;
        var editWidth = wGrp.add("edittext", undefined, "600");
        editWidth.characters = 6;
        var slWidth = wGrp.add("slider", undefined, 600, 20, 3840);
        slWidth.onChanging = function () { editWidth.text = Math.round(this.value); };
        editWidth.onChange = function () { slWidth.value = parseFloat(this.text) || 600; };

        var hGrp = dimPnl.add("group");
        hGrp.add("statictext", undefined, "Height:").characters = 9;
        var editHeight = hGrp.add("edittext", undefined, "300");
        editHeight.characters = 6;
        var slHeight = hGrp.add("slider", undefined, 300, 20, 2160);
        slHeight.onChanging = function () { editHeight.text = Math.round(this.value); };
        editHeight.onChange = function () { slHeight.value = parseFloat(this.text) || 300; };

        // Corner Radii Panel (Default Radii: 200, 100, 50, 25)
        var radPnl = tabGeom.add("panel", undefined, "Corner Radii & Rounding (Timeline Animatable)");
        radPnl.alignChildren = ["fill", "top"];
        radPnl.spacing = 4;

        var masterRoundCheck = radPnl.add("checkbox", undefined, "Round Corners (Master Switch)");
        masterRoundCheck.value = true;

        var linkCheck = radPnl.add("checkbox", undefined, "Link All 4 Corners (Sync with Top-Left)");
        linkCheck.value = false;

        function addCornerRow(label, defaultRadius) {
            var row = radPnl.add("group");
            row.alignChildren = ["left", "center"];

            var chk = row.add("checkbox", undefined, label);
            chk.preferredSize.width = 115;
            chk.value = true;

            var ed = row.add("edittext", undefined, defaultRadius.toString());
            ed.characters = 5;

            var sl = row.add("slider", undefined, defaultRadius, 0, 500);
            sl.onChanging = function () { ed.text = Math.round(this.value); };
            ed.onChange = function () { sl.value = parseFloat(this.text) || defaultRadius; };

            return { group: row, check: chk, edit: ed, slider: sl };
        }

        var cTL = addCornerRow("Top-Left:", 200);
        var cTR = addCornerRow("Top-Right:", 100);
        var cBR = addCornerRow("Bottom-Right:", 50);
        var cBL = addCornerRow("Bottom-Left:", 25);

        function updateCornerUI() {
            var masterOn = masterRoundCheck.value;
            linkCheck.enabled = masterOn;

            var isLinked = masterOn && linkCheck.value;
            cTL.group.enabled = masterOn;
            cTR.group.enabled = masterOn && !isLinked;
            cBR.group.enabled = masterOn && !isLinked;
            cBL.group.enabled = masterOn && !isLinked;

            if (isLinked) {
                cTR.check.value = cTL.check.value;
                cBR.check.value = cTL.check.value;
                cBL.check.value = cTL.check.value;

                cTR.edit.text = cTL.edit.text;
                cTR.slider.value = cTL.slider.value;
                cBR.edit.text = cTL.edit.text;
                cBR.slider.value = cTL.slider.value;
                cBL.edit.text = cTL.edit.text;
                cBL.slider.value = cTL.slider.value;
            }
        }

        masterRoundCheck.onClick = updateCornerUI;
        linkCheck.onClick = updateCornerUI;

        cTL.check.onClick = function () {
            if (linkCheck.value) updateCornerUI();
        };
        cTL.slider.onChanging = function () {
            cTL.edit.text = Math.round(this.value);
            if (linkCheck.value) updateCornerUI();
        };
        cTL.edit.onChange = function () {
            cTL.slider.value = parseFloat(this.text) || 0;
            if (linkCheck.value) updateCornerUI();
        };

        presetList.onChange = function () {
            switch (presetList.selection.index) {
                case 0: // Custom 600x300
                    editWidth.text = "600"; slWidth.value = 600;
                    editHeight.text = "300"; slHeight.value = 300;
                    linkCheck.value = false;
                    cTL.check.value = true; cTL.edit.text = "200"; cTL.slider.value = 200;
                    cTR.check.value = true; cTR.edit.text = "100"; cTR.slider.value = 100;
                    cBR.check.value = true; cBR.edit.text = "50";  cBR.slider.value = 50;
                    cBL.check.value = true; cBL.edit.text = "25";  cBL.slider.value = 25;
                    break;
                case 1: // Square 1080x1080
                    editWidth.text = "1080"; slWidth.value = 1080;
                    editHeight.text = "1080"; slHeight.value = 1080;
                    linkCheck.value = true;
                    cTL.check.value = true; cTL.edit.text = "120"; cTL.slider.value = 120;
                    break;
                case 2: // 16:9 1080p (1920x1080)
                    editWidth.text = "1920"; slWidth.value = 1920;
                    editHeight.text = "1080"; slHeight.value = 1080;
                    linkCheck.value = true;
                    cTL.check.value = true; cTL.edit.text = "80"; cTL.slider.value = 80;
                    break;
                case 3: // 4:3 (1440x1080)
                    editWidth.text = "1440"; slWidth.value = 1440;
                    editHeight.text = "1080"; slHeight.value = 1080;
                    linkCheck.value = true;
                    cTL.check.value = true; cTL.edit.text = "70"; cTL.slider.value = 70;
                    break;
                case 4: // 2:1 (1920x960)
                    editWidth.text = "1920"; slWidth.value = 1920;
                    editHeight.text = "960"; slHeight.value = 960;
                    linkCheck.value = true;
                    cTL.check.value = true; cTL.edit.text = "60"; cTL.slider.value = 60;
                    break;
                case 5: // Credit Card (856x540 ISO/IEC 7810 ID-1)
                    editWidth.text = "856"; slWidth.value = 856;
                    editHeight.text = "540"; slHeight.value = 540;
                    linkCheck.value = true;
                    cTL.check.value = true; cTL.edit.text = "32"; cTL.slider.value = 32;
                    break;
            }
            updateCornerUI();
        };

        updateCornerUI();


        // ====================================================================
        // TAB 2: 3D EXTRUSION
        // ====================================================================
        var tabExt = tabPnl.add("tab", undefined, "3D Extrusion");
        tabExt.alignChildren = ["fill", "top"];
        tabExt.spacing = 6;

        var extCheck = tabExt.add("checkbox", undefined, "Extrude (3D Mesh)");
        extCheck.value = true;

        var extPnl = tabExt.add("panel", undefined, "Extrusion Parameters");
        extPnl.alignChildren = ["fill", "top"];
        extPnl.spacing = 5;

        // Depth with negative value support (-500 to 500, default 60)
        var depthGrp = extPnl.add("group");
        depthGrp.add("statictext", undefined, "Depth (px):").characters = 15;
        var editDepth = depthGrp.add("edittext", undefined, "60");
        editDepth.characters = 6;
        var slDepth = depthGrp.add("slider", undefined, 60, -500, 500);
        slDepth.onChanging = function () { editDepth.text = Math.round(this.value); };
        editDepth.onChange = function () { slDepth.value = parseFloat(this.text) || 60; };

        // Segments slider: min 6, max 15, default 6
        var segGrp = extPnl.add("group");
        segGrp.add("statictext", undefined, "Arc Segments:").characters = 15;
        var editSeg = segGrp.add("edittext", undefined, "6");
        editSeg.characters = 6;
        var slSeg = segGrp.add("slider", undefined, 6, 6, 15);
        slSeg.onChanging = function () { editSeg.text = Math.round(this.value); };
        editSeg.onChange = function () {
            var val = Math.max(6, Math.min(15, Math.round(parseFloat(this.text) || 6)));
            this.text = val.toString();
            slSeg.value = val;
        };
        segGrp.add("statictext", undefined, "(Min 6, Max 15, Default 6)");

        // Shading Intensity
        var shdGrp = extPnl.add("group");
        shdGrp.add("statictext", undefined, "Curved Shading:").characters = 15;
        var editShd = shdGrp.add("edittext", undefined, "15");
        editShd.characters = 6;
        var slShd = shdGrp.add("slider", undefined, 15, 0, 100);
        slShd.onChanging = function () { editShd.text = Math.round(this.value); };
        editShd.onChange = function () { slShd.value = parseFloat(this.text) || 15; };


        // ====================================================================
        // TAB 3: COLORS
        // ====================================================================
        var tabCol = tabPnl.add("tab", undefined, "Colors");
        tabCol.alignChildren = ["fill", "top"];
        tabCol.spacing = 6;

        var colPnl = tabCol.add("panel", undefined, "Color Palette");
        colPnl.alignChildren = ["fill", "top"];
        colPnl.spacing = 6;

        function addColorRow(label, defaultHex) {
            var g = colPnl.add("group");
            g.add("statictext", undefined, label).characters = 18;
            var ed = g.add("edittext", undefined, defaultHex);
            ed.characters = 8;
            var btn = g.add("button", undefined, "Pick");
            btn.size = [50, 22];

            btn.onClick = function () {
                var currentRgba = hexToRgba(ed.text);
                var picked = ($.colorPicker) ? $.colorPicker(currentRgba) : null;
                if (picked !== null && picked !== -1) {
                    var hex = rgbaToHex([
                        ((picked >> 16) & 255) / 255,
                        ((picked >> 8) & 255) / 255,
                        (picked & 255) / 255
                    ]);
                    ed.text = hex;
                }
            };
            return ed;
        }

        // Defaults: Edges Blue (#1E88E5), Front Dark Red (#8B0000), Back Dark Green (#006400)
        var colFront = addColorRow("Front Side (Cap Top):", "#8B0000"); // Dark Red
        var colBack  = addColorRow("Back Side (Cap Bottom):", "#006400"); // Dark Green
        var colEdge  = addColorRow("Edge Walls & Arcs:", "#1E88E5");     // Blue

        var paintInnerCheck = tabCol.add("checkbox", undefined, "Paint inner sides using edge color");
        paintInnerCheck.value = true;


        // ====================================================================
        // TAB 4: FINE TUNING & PERFORMANCE
        // ====================================================================
        var tabFine = tabPnl.add("tab", undefined, "Fine Tuning");
        tabFine.alignChildren = ["fill", "top"];
        tabFine.spacing = 6;

        var finePnl = tabFine.add("panel", undefined, "Precision Tolerances & Anti-Clipping");
        finePnl.alignChildren = ["fill", "top"];
        finePnl.spacing = 5;

        // 1. Gap Tolerance (px) between edge segments
        var seamGrp = finePnl.add("group");
        seamGrp.add("statictext", undefined, "Gap Tolerance:").characters = 20;
        var editSeam = seamGrp.add("edittext", undefined, "0.5");
        editSeam.characters = 5;
        seamGrp.add("statictext", undefined, "px (prevents hairline gaps)");

        // 2. Distance from edge to sides (px) to prevent clipping
        var edgeSidesGrp = finePnl.add("group");
        edgeSidesGrp.add("statictext", undefined, "Edge to Sides Distance:").characters = 20;
        var editEdgeSides = edgeSidesGrp.add("edittext", undefined, "0.2");
        editEdgeSides.characters = 5;
        edgeSidesGrp.add("statictext", undefined, "px (prevents edge clipping)");

        // 3. Distance between inner side vs outer side (px)
        var innerOuterGrp = finePnl.add("group");
        innerOuterGrp.add("statictext", undefined, "Inner vs Outer Distance:").characters = 20;
        var editInnerOuter = innerOuterGrp.add("edittext", undefined, "0.1");
        editInnerOuter.characters = 5;
        innerOuterGrp.add("statictext", undefined, "px (prevents Z-fighting)");

        var perfPnl = tabFine.add("panel", undefined, "Performance & Debug");
        perfPnl.alignChildren = ["fill", "top"];
        perfPnl.spacing = 5;

        var occludeCheck = perfPnl.add("checkbox", undefined, "Enable Occlusion Culling (Hide Non-Visible Faces)");
        occludeCheck.value = false;

        var shyCheck = perfPnl.add("checkbox", undefined, "Shy Secondary Layers (Keep Timeline Clean)");
        shyCheck.value = true;

        var debugLabelCheck = perfPnl.add("checkbox", undefined, "Write Debug Text ('front' and 'back') on Faces");
        debugLabelCheck.value = true;

        var targetGrp = tabFine.add("group");
        targetGrp.add("statictext", undefined, "Build Target:");
        var targetList = targetGrp.add("dropdownlist", undefined, [
            "Dedicated 3D Precomp (Recommended)",
            "Active Composition (Direct Layers)"
        ]);
        targetList.selection = 0;


        // ====================================================================
        // BUILD BUTTON ACTION
        // ====================================================================
        var btnGrp = win.add("group");
        btnGrp.orientation = "row";
        btnGrp.alignChildren = ["fill", "center"];

        var buildBtn = btnGrp.add("button", undefined, "Build Extruded Round Corners");
        buildBtn.preferredSize.height = 36;
        buildBtn.graphics.font = ScriptUI.newFont("sans-serif", "bold", 12);

        buildBtn.onClick = function () {
            var params = {
                width: parseFloat(editWidth.text) || 600,
                height: parseFloat(editHeight.text) || 300,

                roundCornersMaster: masterRoundCheck.value,
                linkCorners: linkCheck.value,

                roundTL: cTL.check.value,
                radiusTL: parseFloat(cTL.edit.text) || 0,

                roundTR: cTR.check.value,
                radiusTR: parseFloat(cTR.edit.text) || 0,

                roundBR: cBR.check.value,
                radiusBR: parseFloat(cBR.edit.text) || 0,

                roundBL: cBL.check.value,
                radiusBL: parseFloat(cBL.edit.text) || 0,

                isExtruded: extCheck.value,
                depth: parseFloat(editDepth.text) || 60,
                segments: Math.max(6, Math.min(15, Math.round(parseFloat(editSeg.text) || 6))),

                capFrontColor: hexToRgba(colFront.text),
                capBackColor: hexToRgba(colBack.text),
                edgeColor: hexToRgba(colEdge.text),
                paintInnerSides: paintInnerCheck.value,

                shading: parseFloat(editShd.text) || 15,
                gapTolerance: parseFloat(editSeam.text) || 0.5,
                edgeSidesDistance: parseFloat(editEdgeSides.text) || 0.2,
                innerOuterDistance: parseFloat(editInnerOuter.text) || 0.1,

                occlusionCulling: occludeCheck.value,
                shySecondary: shyCheck.value,
                showDebugLabels: debugLabelCheck.value,
                targetMode: targetList.selection.index === 0 ? "precomp" : "active"
            };

            buildExtrusionRig(params);
        };

        win.layout.layout(true);
        return win;
    }

    // Launch UI Panel
    var myUI = buildUI(thisObj);
    if (myUI instanceof Window) {
        myUI.center();
        myUI.show();
    }

})(this);
