/**
 * Extruded Round Corners Maker v1.2.0
 * Adobe After Effects Script & ScriptUI Panel
 * 
 * Features:
 * - 2D & 3D Extruded Rounded Rectangle generator with independent corner radii.
 * - Non-C4D / Classic 3D & Advanced 3D native geometry: 2D segment strips with strictly needed count.
 * - Symmetrical perimeter math: Rotate X = 90, Rotate Y = 0, Rotate Z = continuous perimeter angle (0-360 deg).
 * - Inner sides of both caps match the Edge Color.
 * - Full Dynamic Timeline & Expression Animation: Width, Height, Depth, Radii, Colors, Scale, Offset.
 * - "Link All 4 Corners" boolean control: when active, all 4 corners use values from Top-Left.
 * - Universal 2D Pre-comp Screen Wrapper: works in Classic 3D & Advanced 3D without 3D track-matte breaking.
 * - Anti-gap & anti-clipping precision math (sub-pixel seam overlap & cap Z-offset).
 * 
 * Compatible with Adobe After Effects CC 2018 through 2026+.
 */

(function (thisObj) {

    var SCRIPT_NAME = "Extruded Round Corners Maker";
    var SCRIPT_VERSION = "1.2.0";

    // Helper: Hex string to [R, G, B, A] normalized (0-1)
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

    // Helper: Normalized [R, G, B] to Hex
    function rgbaToHex(rgba) {
        var r = Math.round((rgba[0] || 0) * 255).toString(16);
        var g = Math.round((rgba[1] || 0) * 255).toString(16);
        var b = Math.round((rgba[2] || 0) * 255).toString(16);
        if (r.length === 1) r = "0" + r;
        if (g.length === 1) g = "0" + g;
        if (b.length === 1) b = "0" + b;
        return "#" + r + g + b;
    }

    // Helper expression snippet to read radii with "Link All 4 Corners" logic and proportional clamping
    function getRadiiSnippet() {
        return [
            'var link = ctrl.effect("Link All 4 Corners")("Checkbox").value > 0;',
            'var rTL = Math.max(0, ctrl.effect("Radius Top-Left")("Slider").value);',
            'var rTR = Math.max(0, link ? rTL : ctrl.effect("Radius Top-Right")("Slider").value);',
            'var rBR = Math.max(0, link ? rTL : ctrl.effect("Radius Bottom-Right")("Slider").value);',
            'var rBL = Math.max(0, link ? rTL : ctrl.effect("Radius Bottom-Left")("Slider").value);',
            'var maxTop = rTL + rTR; if (maxTop > W) { var s = W / maxTop; rTL *= s; rTR *= s; }',
            'var maxBot = rBL + rBR; if (maxBot > W) { var s = W / maxBot; rBL *= s; rBR *= s; }',
            'var maxLeft = rTL + rBL; if (maxLeft > H) { var s = H / maxLeft; rTL *= s; rBL *= s; }',
            'var maxRight = rTR + rBR; if (maxRight > H) { var s = H / maxRight; rTR *= s; rBR *= s; }'
        ].join('\n');
    }

    // Expression templates
    var EXPRESSIONS = {

        // Expression for Cap shape path (Top and Bottom caps)
        capPath: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
            'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
            getRadiiSnippet(),
            '',
            'var k = 0.5522847498;',
            'var kTL = rTL * k;',
            'var kTR = rTR * k;',
            'var kBR = rBR * k;',
            'var kBL = rBL * k;',
            '',
            'var pts = [',
            '  [-W/2 + rTL, -H/2],',
            '  [W/2 - rTR, -H/2],',
            '  [W/2, -H/2 + rTR],',
            '  [W/2, H/2 - rBR],',
            '  [W/2 - rBR, H/2],',
            '  [-W/2 + rBL, H/2],',
            '  [-W/2, H/2 - rBL],',
            '  [-W/2, -H/2 + rTL]',
            '];',
            '',
            'var inT = [',
            '  [-kTL, 0],',
            '  [0, 0],',
            '  [0, -kTR],',
            '  [0, 0],',
            '  [kBR, 0],',
            '  [0, 0],',
            '  [0, kBL],',
            '  [0, 0]',
            '];',
            '',
            'var outT = [',
            '  [0, 0],',
            '  [kTR, 0],',
            '  [0, 0],',
            '  [0, kBR],',
            '  [0, 0],',
            '  [-kBL, 0],',
            '  [0, 0],',
            '  [0, -kTL]',
            '];',
            '',
            'createPath(pts, inT, outT, true);'
        ].join('\n'),

        // Cap Z-Positions
        capTopPos: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var off = ctrl.effect("Cap Z-Offset (px)")("Slider").value;',
            'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
            '[0, 0, (d >= 0 ? -off : off)];'
        ].join('\n'),

        capBottomPos: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var off = ctrl.effect("Cap Z-Offset (px)")("Slider").value;',
            'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
            '[0, 0, d + (d >= 0 ? off : -off)];'
        ].join('\n'),

        capBottomOpacity: [
            'var ctrl = thisComp.layer("Master Controller");',
            'ctrl.effect("Extruded")("Checkbox").value > 0 ? 100 : 0;'
        ].join('\n'),

        straightWallOpacity: [
            'var ctrl = thisComp.layer("Master Controller");',
            'ctrl.effect("Extruded")("Checkbox").value > 0 ? 100 : 0;'
        ].join('\n'),

        // Straight Wall Sizes & Positions
        topWallSize: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
            'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
            getRadiiSnippet(),
            'var seam = ctrl.effect("Seam Overlap (px)")("Slider").value;',
            'var d = Math.abs(ctrl.effect("Extrusion Depth")("Slider").value);',
            '[Math.max(0.1, W - rTL - rTR + seam), Math.max(0.1, d)];'
        ].join('\n'),

        topWallPos: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = ctrl.effect("Width")("Slider").value;',
            'var H = ctrl.effect("Height")("Slider").value;',
            getRadiiSnippet(),
            'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
            '[(rTL - rTR) / 2, -H / 2, d / 2];'
        ].join('\n'),

        bottomWallSize: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
            'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
            getRadiiSnippet(),
            'var seam = ctrl.effect("Seam Overlap (px)")("Slider").value;',
            'var d = Math.abs(ctrl.effect("Extrusion Depth")("Slider").value);',
            '[Math.max(0.1, W - rBL - rBR + seam), Math.max(0.1, d)];'
        ].join('\n'),

        bottomWallPos: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = ctrl.effect("Width")("Slider").value;',
            'var H = ctrl.effect("Height")("Slider").value;',
            getRadiiSnippet(),
            'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
            '[(rBL - rBR) / 2, H / 2, d / 2];'
        ].join('\n'),

        leftWallSize: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
            'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
            getRadiiSnippet(),
            'var seam = ctrl.effect("Seam Overlap (px)")("Slider").value;',
            'var d = Math.abs(ctrl.effect("Extrusion Depth")("Slider").value);',
            '[Math.max(0.1, H - rTL - rBL + seam), Math.max(0.1, d)];'
        ].join('\n'),

        leftWallPos: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = ctrl.effect("Width")("Slider").value;',
            'var H = ctrl.effect("Height")("Slider").value;',
            getRadiiSnippet(),
            'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
            '[-W / 2, (rTL - rBL) / 2, d / 2];'
        ].join('\n'),

        rightWallSize: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
            'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
            getRadiiSnippet(),
            'var seam = ctrl.effect("Seam Overlap (px)")("Slider").value;',
            'var d = Math.abs(ctrl.effect("Extrusion Depth")("Slider").value);',
            '[Math.max(0.1, H - rTR - rBR + seam), Math.max(0.1, d)];'
        ].join('\n'),

        rightWallPos: [
            'var ctrl = thisComp.layer("Master Controller");',
            'var W = ctrl.effect("Width")("Slider").value;',
            'var H = ctrl.effect("Height")("Slider").value;',
            getRadiiSnippet(),
            'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
            '[W / 2, (rTR - rBR) / 2, d / 2];'
        ].join('\n'),

        // Corner Arc Segments (Strictly Needed Count)
        cornerSegmentSize: function (corner, S) {
            var delta = (Math.PI / 2) / S;
            var sinFactor = 2 * Math.sin(delta / 2);
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
                'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
                getRadiiSnippet(),
                'var R = ' + (corner === 'TL' ? 'rTL' : corner === 'TR' ? 'rTR' : corner === 'BR' ? 'rBR' : 'rBL') + ';',
                'var seam = ctrl.effect("Seam Overlap (px)")("Slider").value;',
                'var d = Math.abs(ctrl.effect("Extrusion Depth")("Slider").value);',
                'var chordW = (R > 0.1) ? (R * ' + sinFactor.toFixed(8) + ' + seam) : 0.001;',
                '[Math.max(0.1, chordW), Math.max(0.1, d)];'
            ].join('\n');
        },

        cornerSegmentPos: function (corner, k, S) {
            var delta = (Math.PI / 2) / S;
            var startAngle = (corner === "TR" ? 0 : corner === "BR" ? Math.PI / 2 : corner === "BL" ? Math.PI : 3 * Math.PI / 2);
            var theta = startAngle + (k + 0.5) * delta;
            var rChordFactor = Math.cos(delta / 2);
            var sinTheta = Math.sin(theta);
            var cosTheta = Math.cos(theta);

            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
                'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
                getRadiiSnippet(),
                'var R = ' + (corner === 'TL' ? 'rTL' : corner === 'TR' ? 'rTR' : corner === 'BR' ? 'rBR' : 'rBL') + ';',
                'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
                'var cx = ' + (corner === 'TL' ? '-W/2 + R' : corner === 'TR' ? 'W/2 - R' : corner === 'BR' ? 'W/2 - R' : '-W/2 + R') + ';',
                'var cy = ' + (corner === 'TL' ? '-H/2 + R' : corner === 'TR' ? '-H/2 + R' : corner === 'BR' ? 'H/2 - R' : 'H/2 - R') + ';',
                'var rChord = R * ' + rChordFactor.toFixed(8) + ';',
                'var x = cx + rChord * (' + sinTheta.toFixed(8) + ');',
                'var y = cy - rChord * (' + cosTheta.toFixed(8) + ');',
                '[x, y, d / 2];'
            ].join('\n');
        },

        cornerSegmentOpacity: function (corner) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var isExt = ctrl.effect("Extruded")("Checkbox").value > 0;',
                'var W = Math.max(1, ctrl.effect("Width")("Slider").value);',
                'var H = Math.max(1, ctrl.effect("Height")("Slider").value);',
                getRadiiSnippet(),
                'var R = ' + (corner === 'TL' ? 'rTL' : corner === 'TR' ? 'rTR' : corner === 'BR' ? 'rBR' : 'rBL') + ';',
                '(isExt && R > 0.1) ? 100 : 0;'
            ].join('\n');
        },

        cornerSegmentColor: function (thetaRad) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var baseCol = ctrl.effect("Edge Color")("Color").value;',
                'var shd = ctrl.effect("Shading Intensity")("Slider").value / 100;',
                'var lightFactor = 1 - Math.cos(' + thetaRad.toFixed(8) + ') * shd * 0.5;',
                'lightFactor = Math.max(0.2, Math.min(1.4, lightFactor));',
                '[baseCol[0] * lightFactor, baseCol[1] * lightFactor, baseCol[2] * lightFactor, baseCol[3]];'
            ].join('\n');
        },

        // Screen Position in 3D scene (Placed snug on Cap without 3D track-matte conflicts)
        screen3DPos: function (isBack) {
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var off = ctrl.effect("Cap Z-Offset (px)")("Slider").value;',
                'var d = ctrl.effect("Extrusion Depth")("Slider").value;',
                (isBack
                    ? '[0, 0, d + (d >= 0 ? off + 0.15 : -off - 0.15)];'
                    : '[0, 0, (d >= 0 ? -off - 0.15 : off + 0.15)];')
            ].join('\n');
        },

        // Cross-Comp Cap Path (for 2D Matte inside Screen Wrapper - works in Classic 3D & Advanced 3D)
        capPathCrossComp: function (targetCompName) {
            return [
                'var ctrl = null;',
                'try { ctrl = comp("' + targetCompName + '").layer("Master Controller"); } catch(e) {}',
                'if (!ctrl) {',
                '  var cList = ["' + targetCompName + '", "Extruded_Round_Corners_1", "Extruded_Round_Corners_2", "Comp 1"];',
                '  for (var i = 0; i < cList.length; i++) {',
                '    try { ctrl = comp(cList[i]).layer("Master Controller"); if (ctrl) break; } catch(err) {}',
                '  }',
                '}',
                'if (!ctrl) ctrl = thisLayer;',
                '',
                'var W = 600, H = 400;',
                'try {',
                '  W = Math.max(1, ctrl.effect("Width")("Slider").value);',
                '  H = Math.max(1, ctrl.effect("Height")("Slider").value);',
                '} catch(e) {}',
                '',
                getRadiiSnippet(),
                '',
                'var k = 0.5522847498;',
                'var kTL = rTL * k, kTR = rTR * k, kBR = rBR * k, kBL = rBL * k;',
                '',
                'var pts = [',
                '  [-W/2 + rTL, -H/2],',
                '  [W/2 - rTR, -H/2],',
                '  [W/2, -H/2 + rTR],',
                '  [W/2, H/2 - rBR],',
                '  [W/2 - rBR, H/2],',
                '  [-W/2 + rBL, H/2],',
                '  [-W/2, H/2 - rBL],',
                '  [-W/2, -H/2 + rTL]',
                '];',
                'var inT = [',
                '  [-kTL, 0], [0, 0], [0, -kTR], [0, 0], [kBR, 0], [0, 0], [0, kBL], [0, 0]',
                '];',
                'var outT = [',
                '  [0, 0], [kTR, 0], [0, 0], [0, kBR], [0, 0], [-kBL, 0], [0, 0], [0, -kTL]',
                '];',
                'createPath(pts, inT, outT, true);'
            ].join('\n');
        },

        // Screen Position inside 2D Wrapper
        screenPosInside: function (targetCompName, isBack) {
            var prefix = isBack ? "Back" : "Front";
            return [
                'var ctrl = null;',
                'try { ctrl = comp("' + targetCompName + '").layer("Master Controller"); } catch(e) {}',
                'if (!ctrl) {',
                '  var cList = ["' + targetCompName + '", "Extruded_Round_Corners_1", "Extruded_Round_Corners_2", "Comp 1"];',
                '  for (var i = 0; i < cList.length; i++) {',
                '    try { ctrl = comp(cList[i]).layer("Master Controller"); if (ctrl) break; } catch(err) {}',
                '  }',
                '}',
                '',
                'var W = 600, H = 400, align = 0, off = [0, 0];',
                'if (ctrl) {',
                '  W = ctrl.effect("Width")("Slider").value;',
                '  H = ctrl.effect("Height")("Slider").value;',
                '  align = Math.round(ctrl.effect("' + prefix + ' Screen Alignment")("Slider").value);',
                '  off = ctrl.effect("' + prefix + ' Screen Offset")("Point").value;',
                '}',
                '',
                'var ax = 0, ay = 0;',
                'switch (align) {',
                '  case 1: ax = -W/2; ay = -H/2; break;',
                '  case 2: ax = 0;    ay = -H/2; break;',
                '  case 3: ax = W/2;  ay = -H/2; break;',
                '  case 4: ax = -W/2; ay = 0;    break;',
                '  case 5: ax = W/2;  ay = 0;    break;',
                '  case 6: ax = -W/2; ay = H/2;  break;',
                '  case 7: ax = 0;    ay = H/2;  break;',
                '  case 8: ax = W/2;  ay = H/2;  break;',
                '  default: ax = 0;   ay = 0;    break;',
                '}',
                '[thisComp.width / 2 + ax + off[0], thisComp.height / 2 + ay + off[1]];'
            ].join('\n');
        },

        // Screen Scale inside 2D Wrapper
        screenScaleInside: function (targetCompName, isBack) {
            var prefix = isBack ? "Back" : "Front";
            return [
                'var ctrl = null;',
                'try { ctrl = comp("' + targetCompName + '").layer("Master Controller"); } catch(e) {}',
                'if (!ctrl) {',
                '  var cList = ["' + targetCompName + '", "Extruded_Round_Corners_1", "Extruded_Round_Corners_2", "Comp 1"];',
                '  for (var i = 0; i < cList.length; i++) {',
                '    try { ctrl = comp(cList[i]).layer("Master Controller"); if (ctrl) break; } catch(err) {}',
                '  }',
                '}',
                'var W = 600, H = 400, mode = 1, man = 1;',
                'if (ctrl) {',
                '  W = Math.max(1, ctrl.effect("Width")("Slider").value);',
                '  H = Math.max(1, ctrl.effect("Height")("Slider").value);',
                '  mode = Math.round(ctrl.effect("' + prefix + ' Screen Scale Mode")("Slider").value);',
                '  man = ctrl.effect("' + prefix + ' Screen Scale")("Slider").value / 100;',
                '}',
                'var sw = sourceRectAtTime().width;',
                'var sh = sourceRectAtTime().height;',
                'if (sw <= 0) sw = 1920; if (sh <= 0) sh = 1080;',
                'var sx = 100, sy = 100;',
                'if (mode === 1) {',
                '  var fit = Math.min(W / sw, H / sh) * 100 * man;',
                '  sx = fit; sy = fit;',
                '} else if (mode === 2) {',
                '  var fill = Math.max(W / sw, H / sh) * 100 * man;',
                '  sx = fill; sy = fill;',
                '} else if (mode === 3) {',
                '  sx = (W / sw) * 100 * man;',
                '  sy = (H / sh) * 100 * man;',
                '} else {',
                '  sx = 100 * man; sy = 100 * man;',
                '}',
                '[sx, sy];'
            ].join('\n');
        },

        // Screen Anchor inside 2D Wrapper
        screenAnchorInside: function (targetCompName, isBack) {
            var prefix = isBack ? "Back" : "Front";
            return [
                'var ctrl = null;',
                'try { ctrl = comp("' + targetCompName + '").layer("Master Controller"); } catch(e) {}',
                'var align = 0;',
                'if (ctrl) {',
                '  align = Math.round(ctrl.effect("' + prefix + ' Screen Alignment")("Slider").value);',
                '}',
                'var sr = sourceRectAtTime();',
                'var l = sr.left, t = sr.top, w = sr.width, h = sr.height;',
                'var ax = l + w / 2, ay = t + h / 2;',
                'switch (align) {',
                '  case 1: ax = l;         ay = t;         break;',
                '  case 2: ax = l + w / 2; ay = t;         break;',
                '  case 3: ax = l + w;     ay = t;         break;',
                '  case 4: ax = l;         ay = t + h / 2; break;',
                '  case 5: ax = l + w;     ay = t + h / 2; break;',
                '  case 6: ax = l;         ay = t + h;     break;',
                '  case 7: ax = l + w / 2; ay = t + h;     break;',
                '  case 8: ax = l + w;     ay = t + h;     break;',
                '  default: ax = l + w / 2; ay = t + h / 2; break;',
                '}',
                '[ax, ay];'
            ].join('\n');
        },

        screenOpacity: function (isBack) {
            var prefix = isBack ? "Back" : "Front";
            return [
                'var ctrl = thisComp.layer("Master Controller");',
                'var en = ctrl.effect("' + prefix + ' Screen Enabled")("Checkbox").value > 0;',
                'en ? ctrl.effect("' + prefix + ' Screen Opacity")("Slider").value : 0;'
            ].join('\n');
        }
    };

    // Rig Builder Function
    function buildExtrusionRig(params) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select or open an active composition first.", SCRIPT_NAME);
            return null;
        }

        app.beginUndoGroup("Create Extruded Round Corners");

        try {
            var targetComp = comp;
            var masterCompLayer = null;

            // If user wants a dedicated 3D precomp
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

            // 1. Create Master Controller 3D Null
            var ctrl = targetComp.layers.addNull();
            ctrl.name = "Master Controller";
            ctrl.threeDLayer = true;
            ctrl.position.setValue([targetComp.width / 2, targetComp.height / 2, 0]);

            // Add Custom Controls to Master Controller
            // Geometry Group
            var fxExtruded = ctrl.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
            fxExtruded.name = "Extruded";
            fxExtruded.property(1).setValue(params.isExtruded ? 1 : 0);

            var fxWidth = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxWidth.name = "Width";
            fxWidth.property(1).setValue(params.width);

            var fxHeight = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxHeight.name = "Height";
            fxHeight.property(1).setValue(params.height);

            // Link All 4 Corners boolean: when active, all 4 corners use values from Top-Left
            var fxLink = ctrl.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
            fxLink.name = "Link All 4 Corners";
            fxLink.property(1).setValue(params.linkRadii ? 1 : 0);

            var fxRadTL = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxRadTL.name = "Radius Top-Left";
            fxRadTL.property(1).setValue(params.radiusTL);

            var fxRadTR = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxRadTR.name = "Radius Top-Right";
            fxRadTR.property(1).setValue(params.radiusTR);

            var fxRadBR = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxRadBR.name = "Radius Bottom-Right";
            fxRadBR.property(1).setValue(params.radiusBR);

            var fxRadBL = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxRadBL.name = "Radius Bottom-Left";
            fxRadBL.property(1).setValue(params.radiusBL);

            // Extrusion Group
            var fxDepth = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxDepth.name = "Extrusion Depth";
            fxDepth.property(1).setValue(params.depth);

            var fxSeam = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxSeam.name = "Seam Overlap (px)";
            fxSeam.property(1).setValue(params.seamOverlap);

            var fxCapOff = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxCapOff.name = "Cap Z-Offset (px)";
            fxCapOff.property(1).setValue(params.capOffset);

            // Colors Group
            var fxCapTopCol = ctrl.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            fxCapTopCol.name = "Cap Top Color";
            fxCapTopCol.property(1).setValue(params.capTopColor);

            var fxCapBotCol = ctrl.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            fxCapBotCol.name = "Cap Bottom Color";
            fxCapBotCol.property(1).setValue(params.capBotColor);

            var fxEdgeCol = ctrl.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            fxEdgeCol.name = "Edge Color";
            fxEdgeCol.property(1).setValue(params.edgeColor);

            var fxShading = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxShading.name = "Shading Intensity";
            fxShading.property(1).setValue(params.shading);

            // Screen Controls Group
            var fxFScreenEn = ctrl.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
            fxFScreenEn.name = "Front Screen Enabled";
            fxFScreenEn.property(1).setValue((params.screenMode === "top" || params.screenMode === "both" || params.screenMode === "both_sep") ? 1 : 0);

            var fxFScreenAlign = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxFScreenAlign.name = "Front Screen Alignment";
            fxFScreenAlign.property(1).setValue(params.screenAlign);

            var fxFScreenOff = ctrl.property("ADBE Effect Parade").addProperty("ADBE Point Control");
            fxFScreenOff.name = "Front Screen Offset";
            fxFScreenOff.property(1).setValue([params.screenOffsetX, params.screenOffsetY]);

            var fxFScreenScaleM = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxFScreenScaleM.name = "Front Screen Scale Mode";
            fxFScreenScaleM.property(1).setValue(params.screenScaleMode);

            var fxFScreenScale = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxFScreenScale.name = "Front Screen Scale";
            fxFScreenScale.property(1).setValue(params.screenScale);

            var fxFScreenOp = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxFScreenOp.name = "Front Screen Opacity";
            fxFScreenOp.property(1).setValue(100);

            // Back Screen Controls Group
            var fxBScreenEn = ctrl.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
            fxBScreenEn.name = "Back Screen Enabled";
            fxBScreenEn.property(1).setValue((params.screenMode === "bottom" || params.screenMode === "both" || params.screenMode === "both_sep") ? 1 : 0);

            var fxBScreenAlign = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxBScreenAlign.name = "Back Screen Alignment";
            fxBScreenAlign.property(1).setValue(params.screenAlign);

            var fxBScreenOff = ctrl.property("ADBE Effect Parade").addProperty("ADBE Point Control");
            fxBScreenOff.name = "Back Screen Offset";
            fxBScreenOff.property(1).setValue([params.screenOffsetX, params.screenOffsetY]);

            var fxBScreenScaleM = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxBScreenScaleM.name = "Back Screen Scale Mode";
            fxBScreenScaleM.property(1).setValue(params.screenScaleMode);

            var fxBScreenScale = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxBScreenScale.name = "Back Screen Scale";
            fxBScreenScale.property(1).setValue(params.screenScale);

            var fxBScreenOp = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fxBScreenOp.name = "Back Screen Opacity";
            fxBScreenOp.property(1).setValue(100);

            // 2. Helper to build Cap Shape Layers (Outer & Inner)
            function createCapShapeLayer(name, isTop, isInner) {
                var shapeLayer = targetComp.layers.addShape();
                shapeLayer.name = name;
                shapeLayer.threeDLayer = true;
                shapeLayer.parent = ctrl;
                shapeLayer.shy = isInner ? params.shySecondary : false;

                // Position expression
                if (isTop) {
                    shapeLayer.property("ADBE Transform Group").property("ADBE Position").expression =
                        isInner
                            ? 'var ctrl = thisComp.layer("Master Controller"); var off = ctrl.effect("Cap Z-Offset (px)")("Slider").value; var d = ctrl.effect("Extrusion Depth")("Slider").value; [0, 0, (d >= 0 ? -off + 0.08 : off - 0.08)];'
                            : EXPRESSIONS.capTopPos;
                } else {
                    shapeLayer.property("ADBE Transform Group").property("ADBE Position").expression =
                        isInner
                            ? 'var ctrl = thisComp.layer("Master Controller"); var off = ctrl.effect("Cap Z-Offset (px)")("Slider").value; var d = ctrl.effect("Extrusion Depth")("Slider").value; [0, 0, d + (d >= 0 ? off - 0.08 : -off + 0.08)];'
                            : EXPRESSIONS.capBottomPos;
                }

                if (!isTop || isInner) {
                    shapeLayer.property("ADBE Transform Group").property("ADBE Opacity").expression =
                        EXPRESSIONS.capBottomOpacity; // Active only when Extruded is ON
                }

                var contents = shapeLayer.property("ADBE Root Vectors Group");
                var shapeGroup = contents.addProperty("ADBE Vector Group");
                shapeGroup.name = "Cap Shape";
                var groupVectors = shapeGroup.property("ADBE Vectors Group");

                var pathProp = groupVectors.addProperty("ADBE Vector Shape - Group");
                pathProp.name = "Rounded Rect Path";
                pathProp.property("ADBE Vector Shape").expression = EXPRESSIONS.capPath;

                var fillProp = groupVectors.addProperty("ADBE Vector Graphic - Fill");
                fillProp.name = "Cap Fill";
                fillProp.property("ADBE Vector Fill Color").expression =
                    isInner
                        ? 'thisComp.layer("Master Controller").effect("Edge Color")("Color");'
                        : 'thisComp.layer("Master Controller").effect("' + (isTop ? "Cap Top Color" : "Cap Bottom Color") + '")("Color");';

                return shapeLayer;
            }

            var capTop = createCapShapeLayer("Cap Top", true, false);
            var capTopInner = createCapShapeLayer("Cap Top Inner", true, true);
            var capBot = createCapShapeLayer("Cap Bottom", false, false);
            var capBotInner = createCapShapeLayer("Cap Bottom Inner", false, true);

            // 3. Helper to create Screen Layer with Self-Contained 2D Pre-comp Matte
            // (Works flawlessly in Classic 3D, Advanced 3D, and Cinema 4D without 3D track-matte conflicts)
            function createScreenRig(isBack, sourceComp) {
                var prefix = isBack ? "Back" : "Front";
                var wrapW = Math.max(3840, targetComp.width * 2);
                var wrapH = Math.max(2160, targetComp.height * 2);

                // Create 2D Mounted Wrapper Comp
                var wrapperComp = app.project.items.addComp(
                    "[" + prefix + " Screen Mounted]",
                    wrapW,
                    wrapH,
                    1.0,
                    targetComp.duration,
                    targetComp.frameRate
                );

                // 1. Matte Shape Layer (2D) inside wrapper
                var matte = wrapperComp.layers.addShape();
                matte.name = prefix + " Screen Matte (2D)";
                matte.position.setValue([wrapW / 2, wrapH / 2]);

                var matteContents = matte.property("ADBE Root Vectors Group");
                var matteGroup = matteContents.addProperty("ADBE Vector Group");
                var matteGroupVectors = matteGroup.property("ADBE Vectors Group");
                var mattePath = matteGroupVectors.addProperty("ADBE Vector Shape - Group");
                mattePath.property("ADBE Vector Shape").expression = EXPRESSIONS.capPathCrossComp(targetComp.name);
                var matteFill = matteGroupVectors.addProperty("ADBE Vector Graphic - Fill");
                matteFill.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);

                // 2. User Content Comp Layer (2D) inside wrapper
                var contentLayer = wrapperComp.layers.add(sourceComp);
                contentLayer.name = "Content";
                contentLayer.property("ADBE Transform Group").property("ADBE Anchor Point").expression =
                    EXPRESSIONS.screenAnchorInside(targetComp.name, isBack);
                contentLayer.property("ADBE Transform Group").property("ADBE Position").expression =
                    EXPRESSIONS.screenPosInside(targetComp.name, isBack);
                contentLayer.property("ADBE Transform Group").property("ADBE Scale").expression =
                    EXPRESSIONS.screenScaleInside(targetComp.name, isBack);

                // Set 2D Track Matte inside the wrapper
                try {
                    if (contentLayer.setTrackMatte) {
                        contentLayer.setTrackMatte(matte, TrackMatteType.ALPHA);
                    } else {
                        matte.moveBefore(contentLayer);
                        contentLayer.trackMatteType = TrackMatteType.ALPHA;
                    }
                } catch (e) {
                    try {
                        matte.moveBefore(contentLayer);
                        contentLayer.trackMatteType = TrackMatteType.ALPHA;
                    } catch (err) {}
                }

                // 3. Add the wrapper as a single 3D layer into the 3D scene (targetComp)
                var screenLayer = targetComp.layers.add(wrapperComp);
                screenLayer.name = prefix + " Screen [Screen Content]";
                screenLayer.threeDLayer = true;
                screenLayer.parent = ctrl;
                screenLayer.shy = false;

                screenLayer.property("ADBE Transform Group").property("ADBE Position").expression =
                    EXPRESSIONS.screen3DPos(isBack);

                if (isBack) {
                    screenLayer.property("ADBE Transform Group").property("ADBE Rotate Y").setValue(180);
                }

                screenLayer.property("ADBE Transform Group").property("ADBE Opacity").expression =
                    EXPRESSIONS.screenOpacity(isBack);

                return screenLayer;
            }

            // Create Screen Precomps if requested
            if (params.screenMode !== "none") {
                var screenFrontComp = null;
                var screenBackComp = null;

                function createPlaceholderComp(title) {
                    var sComp = app.project.items.addComp(
                        title,
                        1920,
                        1080,
                        1.0,
                        comp.duration,
                        comp.frameRate
                    );
                    var bg = sComp.layers.addSolid([0.1, 0.12, 0.15], "Background", 1920, 1080, 1.0);
                    var centerNull = sComp.layers.addNull();
                    centerNull.position.setValue([960, 540]);

                    var sampleText = sComp.layers.addText("REPLACE WITH YOUR CONTENT");
                    var textProp = sampleText.property("ADBE Text Properties").property("ADBE Text Document");
                    var textDoc = textProp.value;
                    textDoc.fontSize = 64;
                    textDoc.fillColor = [1, 1, 1];
                    textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                    textProp.setValue(textDoc);
                    sampleText.position.setValue([960, 540]);

                    return sComp;
                }

                if (params.screenMode === "top" || params.screenMode === "both") {
                    screenFrontComp = createPlaceholderComp("[Screen] Front Cap Content");
                    createScreenRig(false, screenFrontComp);
                } else if (params.screenMode === "both_sep") {
                    screenFrontComp = createPlaceholderComp("[Screen] Front Cap Content");
                    createScreenRig(false, screenFrontComp);
                    screenBackComp = createPlaceholderComp("[Screen] Back Cap Content");
                    createScreenRig(true, screenBackComp);
                }

                if (params.screenMode === "bottom") {
                    screenBackComp = createPlaceholderComp("[Screen] Back Cap Content");
                    createScreenRig(true, screenBackComp);
                } else if (params.screenMode === "both" && screenFrontComp) {
                    createScreenRig(true, screenFrontComp);
                }
            }

            // 4. Create Straight Wall Segments
            function createStraightWall(name, sizeExp, posExp, rotX, rotY, rotZ) {
                var wall = targetComp.layers.addShape();
                wall.name = name;
                wall.threeDLayer = true;
                wall.parent = ctrl;
                wall.shy = params.shySecondary;

                var tr = wall.property("ADBE Transform Group");
                tr.property("ADBE Position").expression = posExp;
                tr.property("ADBE Rotate X").setValue(rotX);
                tr.property("ADBE Rotate Y").setValue(rotY);
                tr.property("ADBE Rotate Z").setValue(rotZ);
                tr.property("ADBE Opacity").expression = EXPRESSIONS.straightWallOpacity;

                var contents = wall.property("ADBE Root Vectors Group");
                var grp = contents.addProperty("ADBE Vector Group");
                var gVecs = grp.property("ADBE Vectors Group");

                var rect = gVecs.addProperty("ADBE Vector Shape - Rect");
                rect.property("ADBE Vector Rect Size").expression = sizeExp;

                var fill = gVecs.addProperty("ADBE Vector Graphic - Fill");
                fill.property("ADBE Vector Fill Color").expression =
                    'thisComp.layer("Master Controller").effect("Edge Color")("Color");';

                return wall;
            }

            createStraightWall("Wall Top", EXPRESSIONS.topWallSize, EXPRESSIONS.topWallPos, 90, 0, 0);
            createStraightWall("Wall Right", EXPRESSIONS.rightWallSize, EXPRESSIONS.rightWallPos, 90, 0, 90);
            createStraightWall("Wall Bottom", EXPRESSIONS.bottomWallSize, EXPRESSIONS.bottomWallPos, 90, 0, 180);
            createStraightWall("Wall Left", EXPRESSIONS.leftWallSize, EXPRESSIONS.leftWallPos, 90, 0, 270);

            // 5. Create Corner Arc Segments (STRICTLY THE NEEDED COUNT)
            var S = params.segments; // e.g. 6 to 24 strictly needed
            var corners = ["TR", "BR", "BL", "TL"];

            for (var c = 0; c < corners.length; c++) {
                var cName = corners[c];
                var delta = (Math.PI / 2) / S;
                var startAngle = (cName === "TR" ? 0 : cName === "BR" ? Math.PI / 2 : cName === "BL" ? Math.PI : 3 * Math.PI / 2);

                for (var k = 0; k < S; k++) {
                    var thetaRad = startAngle + (k + 0.5) * delta;
                    var thetaDeg = thetaRad * 180 / Math.PI;

                    var segLayer = targetComp.layers.addShape();
                    segLayer.name = "Arc " + cName + " [" + (k + 1) + "]";
                    segLayer.threeDLayer = true;
                    segLayer.parent = ctrl;
                    segLayer.shy = params.shySecondary;

                    var tr = segLayer.property("ADBE Transform Group");
                    tr.property("ADBE Position").expression = EXPRESSIONS.cornerSegmentPos(cName, k, S);
                    tr.property("ADBE Rotate X").setValue(90);
                    tr.property("ADBE Rotate Y").setValue(0);
                    tr.property("ADBE Rotate Z").setValue(thetaDeg);
                    tr.property("ADBE Opacity").expression = EXPRESSIONS.cornerSegmentOpacity(cName);

                    var contents = segLayer.property("ADBE Root Vectors Group");
                    var grp = contents.addProperty("ADBE Vector Group");
                    var gVecs = grp.property("ADBE Vectors Group");

                    var rect = gVecs.addProperty("ADBE Vector Shape - Rect");
                    rect.property("ADBE Vector Rect Size").expression = EXPRESSIONS.cornerSegmentSize(cName, S);

                    var fill = gVecs.addProperty("ADBE Vector Graphic - Fill");
                    fill.property("ADBE Vector Fill Color").expression = EXPRESSIONS.cornerSegmentColor(thetaRad);
                }
            }

            // Move Master Controller to top
            ctrl.moveToBeginning();
            targetComp.hideShyLayers = params.shySecondary;

        } catch (err) {
            alert("Error building rig: " + err.toString(), SCRIPT_NAME);
        } finally {
            app.endUndoGroup();
        }
    }

    // ScriptUI Interface Builder
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // Title Header
        var titleGrp = win.add("group");
        titleGrp.orientation = "row";
        titleGrp.alignChildren = ["left", "center"];
        var titleTxt = titleGrp.add("statictext", undefined, SCRIPT_NAME);
        titleTxt.graphics.font = ScriptUI.newFont("sans-serif", "bold", 14);
        var verTxt = titleGrp.add("statictext", undefined, "v" + SCRIPT_VERSION);
        verTxt.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1);

        // Tabbed Panel
        var tabPnl = win.add("tabbedpanel");
        tabPnl.alignChildren = ["fill", "fill"];

        // ---------------- TAB 1: GEOMETRY ----------------
        var tabGeom = tabPnl.add("tab", undefined, "Geometry");
        tabGeom.alignChildren = ["fill", "top"];
        tabGeom.spacing = 6;

        // Preset Selector
        var presetGrp = tabGeom.add("group");
        presetGrp.add("statictext", undefined, "Quick Preset:");
        var presetList = presetGrp.add("dropdownlist", undefined, [
            "Custom",
            "Smartphone Mockup (Phone Screen)",
            "Credit / ID Card",
            "Rounded 3D Tile",
            "UI Button Pill",
            "Sharp Corner Box"
        ]);
        presetList.selection = 0;

        // Dimensions Group
        var dimGrp = tabGeom.add("panel", undefined, "Dimensions (px)");
        dimGrp.alignChildren = ["fill", "top"];
        dimGrp.spacing = 4;

        var wGrp = dimGrp.add("group");
        wGrp.add("statictext", undefined, "Width:").characters = 8;
        var editWidth = wGrp.add("edittext", undefined, "600");
        editWidth.characters = 6;
        var slWidth = wGrp.add("slider", undefined, 600, 20, 3840);
        slWidth.onChanging = function () { editWidth.text = Math.round(this.value); };
        editWidth.onChange = function () { slWidth.value = parseFloat(this.text) || 600; };

        var hGrp = dimGrp.add("group");
        hGrp.add("statictext", undefined, "Height:").characters = 8;
        var editHeight = hGrp.add("edittext", undefined, "400");
        editHeight.characters = 6;
        var slHeight = hGrp.add("slider", undefined, 400, 20, 2160);
        slHeight.onChanging = function () { editHeight.text = Math.round(this.value); };
        editHeight.onChange = function () { slHeight.value = parseFloat(this.text) || 400; };

        // Corner Radii Group
        var radPnl = tabGeom.add("panel", undefined, "Corner Radii (px)");
        radPnl.alignChildren = ["fill", "top"];
        radPnl.spacing = 4;

        var linkCheck = radPnl.add("checkbox", undefined, "Link All 4 Corners (Uses Top-Left)");
        linkCheck.value = true;

        function addRadiusRow(label, defaultVal) {
            var g = radPnl.add("group");
            g.add("statictext", undefined, label).characters = 12;
            var ed = g.add("edittext", undefined, defaultVal.toString());
            ed.characters = 5;
            var sl = g.add("slider", undefined, defaultVal, 0, 500);
            sl.onChanging = function () { ed.text = Math.round(this.value); };
            ed.onChange = function () { sl.value = parseFloat(this.text) || defaultVal; };
            return { group: g, edit: ed, slider: sl };
        }

        var rTL = addRadiusRow("Top-Left:", 80);
        var rTR = addRadiusRow("Top-Right:", 80);
        var rBR = addRadiusRow("Bottom-Right:", 80);
        var rBL = addRadiusRow("Bottom-Left:", 80);

        function updateRadiiUI() {
            var isLinked = linkCheck.value;
            rTR.group.enabled = !isLinked;
            rBR.group.enabled = !isLinked;
            rBL.group.enabled = !isLinked;
            if (isLinked) {
                rTR.edit.text = rTL.edit.text;
                rTR.slider.value = rTL.slider.value;
                rBR.edit.text = rTL.edit.text;
                rBR.slider.value = rTL.slider.value;
                rBL.edit.text = rTL.edit.text;
                rBL.slider.value = rTL.slider.value;
            }
        }

        rTL.slider.onChanging = function () {
            rTL.edit.text = Math.round(this.value);
            if (linkCheck.value) updateRadiiUI();
        };
        rTL.edit.onChange = function () {
            rTL.slider.value = parseFloat(this.text) || 0;
            if (linkCheck.value) updateRadiiUI();
        };

        linkCheck.onClick = function () {
            updateRadiiUI();
        };
        updateRadiiUI();

        // ---------------- TAB 2: EXTRUSION & EDGES ----------------
        var tabExt = tabPnl.add("tab", undefined, "Extrusion");
        tabExt.alignChildren = ["fill", "top"];
        tabExt.spacing = 6;

        var extCheck = tabExt.add("checkbox", undefined, "Extrude (3D Pseudo-Mesh)");
        extCheck.value = true;

        var extPnl = tabExt.add("panel", undefined, "Extrusion Parameters");
        extPnl.alignChildren = ["fill", "top"];
        extPnl.spacing = 5;

        // Depth
        var depthGrp = extPnl.add("group");
        depthGrp.add("statictext", undefined, "Depth:").characters = 14;
        var editDepth = depthGrp.add("edittext", undefined, "60");
        editDepth.characters = 6;
        var slDepth = depthGrp.add("slider", undefined, 60, -500, 500);
        slDepth.onChanging = function () { editDepth.text = Math.round(this.value); };
        editDepth.onChange = function () { slDepth.value = parseFloat(this.text) || 60; };

        // Segments (6 - 24 strictly needed)
        var segGrp = extPnl.add("group");
        segGrp.add("statictext", undefined, "Arc Segments:").characters = 14;
        var editSeg = segGrp.add("edittext", undefined, "10");
        editSeg.characters = 6;
        var slSeg = segGrp.add("slider", undefined, 10, 6, 24);
        slSeg.onChanging = function () { editSeg.text = Math.round(this.value); };
        editSeg.onChange = function () {
            var val = Math.max(6, Math.min(24, Math.round(parseFloat(this.text) || 10)));
            this.text = val.toString();
            slSeg.value = val;
        };

        // Precision Seam Overlap
        var seamGrp = extPnl.add("group");
        seamGrp.add("statictext", undefined, "Seam Overlap:").characters = 14;
        var editSeam = seamGrp.add("edittext", undefined, "0.5");
        editSeam.characters = 6;
        seamGrp.add("statictext", undefined, "px (prevents hairline gaps)");

        // Cap Z-Offset
        var offGrp = extPnl.add("group");
        offGrp.add("statictext", undefined, "Cap Inset/Offset:").characters = 14;
        var editCapOff = offGrp.add("edittext", undefined, "0.1");
        editCapOff.characters = 6;
        offGrp.add("statictext", undefined, "px (prevents Z-fighting)");

        // Shading Intensity
        var shdGrp = extPnl.add("group");
        shdGrp.add("statictext", undefined, "Curved Shading:").characters = 14;
        var editShd = shdGrp.add("edittext", undefined, "15");
        editShd.characters = 6;
        var slShd = shdGrp.add("slider", undefined, 15, 0, 100);
        slShd.onChanging = function () { editShd.text = Math.round(this.value); };
        editShd.onChange = function () { slShd.value = parseFloat(this.text) || 15; };

        // ---------------- TAB 3: COLORS & STYLING ----------------
        var tabCol = tabPnl.add("tab", undefined, "Colors");
        tabCol.alignChildren = ["fill", "top"];
        tabCol.spacing = 6;

        var colPnl = tabCol.add("panel", undefined, "Color Settings");
        colPnl.alignChildren = ["fill", "top"];
        colPnl.spacing = 6;

        function addColorSelector(label, defaultHex) {
            var g = colPnl.add("group");
            g.add("statictext", undefined, label).characters = 14;
            var ed = g.add("edittext", undefined, defaultHex);
            ed.characters = 8;
            var colBtn = g.add("button", undefined, "Pick");
            colBtn.size = [50, 22];

            colBtn.onClick = function () {
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

        var colTop = addColorSelector("Cap Top / Front:", "#1E88E5");
        var colBot = addColorSelector("Cap Bottom / Back:", "#0D47A1");
        var colEdge = addColorSelector("Edge Walls:", "#1565C0");

        // ---------------- TAB 4: SCREEN / COMP PLAYBACK ----------------
        var tabScreen = tabPnl.add("tab", undefined, "Cap Screen");
        tabScreen.alignChildren = ["fill", "top"];
        tabScreen.spacing = 6;

        var scModeGrp = tabScreen.add("group");
        scModeGrp.add("statictext", undefined, "Screen Mode:");
        var screenModeList = scModeGrp.add("dropdownlist", undefined, [
            "None",
            "Top / Front Cap Only",
            "Bottom / Back Cap Only",
            "Both Caps (Shared Comp)",
            "Both Caps (Separate Comps)"
        ]);
        screenModeList.selection = 0;

        var scPnl = tabScreen.add("panel", undefined, "Screen Placement & Scaling");
        scPnl.alignChildren = ["fill", "top"];
        scPnl.spacing = 5;

        // Alignment
        var alignGrp = scPnl.add("group");
        alignGrp.add("statictext", undefined, "Alignment:").characters = 12;
        var alignList = alignGrp.add("dropdownlist", undefined, [
            "Center",
            "Top-Left",
            "Top-Center",
            "Top-Right",
            "Center-Left",
            "Center-Right",
            "Bottom-Left",
            "Bottom-Center",
            "Bottom-Right"
        ]);
        alignList.selection = 0;

        // Scale Mode
        var scaleModeGrp = scPnl.add("group");
        scaleModeGrp.add("statictext", undefined, "Scale Mode:").characters = 12;
        var scaleModeList = scaleModeGrp.add("dropdownlist", undefined, [
            "Manual Scale (%)",
            "Auto Fit (Inside)",
            "Auto Fill (Cover)",
            "Stretch to Cap"
        ]);
        scaleModeList.selection = 1;

        // Manual Scale
        var manScaleGrp = scPnl.add("group");
        manScaleGrp.add("statictext", undefined, "Scale Adjust:").characters = 12;
        var editScreenScale = manScaleGrp.add("edittext", undefined, "100");
        editScreenScale.characters = 5;
        var slScreenScale = manScaleGrp.add("slider", undefined, 100, 10, 500);
        slScreenScale.onChanging = function () { editScreenScale.text = Math.round(this.value); };
        editScreenScale.onChange = function () { slScreenScale.value = parseFloat(this.text) || 100; };

        // Offsets
        var scOffGrp = scPnl.add("group");
        scOffGrp.add("statictext", undefined, "Offset (X, Y):").characters = 12;
        var editOffX = scOffGrp.add("edittext", undefined, "0");
        editOffX.characters = 4;
        scOffGrp.add("statictext", undefined, ",");
        var editOffY = scOffGrp.add("edittext", undefined, "0");
        editOffY.characters = 4;
        scOffGrp.add("statictext", undefined, "px");

        // ---------------- TAB 5: BUILD & RIG OPTIONS ----------------
        var tabBuild = tabPnl.add("tab", undefined, "Build Options");
        tabBuild.alignChildren = ["fill", "top"];
        tabBuild.spacing = 6;

        var targetGrp = tabBuild.add("group");
        targetGrp.add("statictext", undefined, "Build Destination:");
        var targetList = targetGrp.add("dropdownlist", undefined, [
            "Dedicated 3D Precomp (Clean & Self-Contained)",
            "Active Composition (Direct Layers)"
        ]);
        targetList.selection = 0;

        var shyCheck = tabBuild.add("checkbox", undefined, "Shy Secondary Layers (Keep timeline organized)");
        shyCheck.value = true;

        // Preset Change Listener
        presetList.onChange = function () {
            switch (presetList.selection.index) {
                case 1: // Smartphone
                    editWidth.text = "450"; slWidth.value = 450;
                    editHeight.text = "920"; slHeight.value = 920;
                    linkCheck.value = true;
                    rTL.edit.text = "75"; rTL.slider.value = 75;
                    editDepth.text = "35"; slDepth.value = 35;
                    editSeg.text = "10"; slSeg.value = 10;
                    screenModeList.selection = 1;
                    scaleModeList.selection = 1;
                    colTop.text = "#101010"; colBot.text = "#252528"; colEdge.text = "#434346";
                    break;
                case 2: // Credit Card
                    editWidth.text = "856"; slWidth.value = 856;
                    editHeight.text = "540"; slHeight.value = 540;
                    linkCheck.value = true;
                    rTL.edit.text = "32"; rTL.slider.value = 32;
                    editDepth.text = "8"; slDepth.value = 8;
                    editSeg.text = "8"; slSeg.value = 8;
                    colTop.text = "#D4AF37"; colBot.text = "#B8860B"; colEdge.text = "#C5A028";
                    break;
                case 3: // 3D Tile
                    editWidth.text = "500"; slWidth.value = 500;
                    editHeight.text = "500"; slHeight.value = 500;
                    linkCheck.value = true;
                    rTL.edit.text = "60"; rTL.slider.value = 60;
                    editDepth.text = "80"; slDepth.value = 80;
                    editSeg.text = "10"; slSeg.value = 10;
                    colTop.text = "#00C853"; colBot.text = "#1B5E20"; colEdge.text = "#2E7D32";
                    break;
                case 4: // UI Button Pill
                    editWidth.text = "360"; slWidth.value = 360;
                    editHeight.text = "100"; slHeight.value = 100;
                    linkCheck.value = true;
                    rTL.edit.text = "50"; rTL.slider.value = 50;
                    editDepth.text = "25"; slDepth.value = 25;
                    editSeg.text = "12"; slSeg.value = 12;
                    colTop.text = "#FF6D00"; colBot.text = "#D50000"; colEdge.text = "#E65100";
                    break;
                case 5: // Sharp Corner Box
                    editWidth.text = "500"; slWidth.value = 500;
                    editHeight.text = "350"; slHeight.value = 350;
                    linkCheck.value = true;
                    rTL.edit.text = "0"; rTL.slider.value = 0;
                    editDepth.text = "120"; slDepth.value = 120;
                    editSeg.text = "6"; slSeg.value = 6;
                    colTop.text = "#673AB7"; colBot.text = "#311B92"; colEdge.text = "#512DA8";
                    break;
            }
            updateRadiiUI();
        };

        // ---------------- ACTION BUTTONS ----------------
        var btnGrp = win.add("group");
        btnGrp.orientation = "row";
        btnGrp.alignChildren = ["fill", "center"];

        var buildBtn = btnGrp.add("button", undefined, "Build Extruded Round Corners");
        buildBtn.preferredSize.height = 36;
        buildBtn.graphics.font = ScriptUI.newFont("sans-serif", "bold", 12);

        buildBtn.onClick = function () {
            var screenModes = ["none", "top", "bottom", "both", "both_sep"];
            var params = {
                width: parseFloat(editWidth.text) || 600,
                height: parseFloat(editHeight.text) || 400,
                linkRadii: linkCheck.value,
                radiusTL: parseFloat(rTL.edit.text) || 0,
                radiusTR: parseFloat(rTR.edit.text) || 0,
                radiusBR: parseFloat(rBR.edit.text) || 0,
                radiusBL: parseFloat(rBL.edit.text) || 0,
                isExtruded: extCheck.value,
                depth: parseFloat(editDepth.text) || 60,
                segments: Math.max(6, Math.min(24, Math.round(parseFloat(editSeg.text) || 10))),
                seamOverlap: parseFloat(editSeam.text) || 0.5,
                capOffset: parseFloat(editCapOff.text) || 0.1,
                shading: parseFloat(editShd.text) || 15,
                capTopColor: hexToRgba(colTop.text),
                capBotColor: hexToRgba(colBot.text),
                edgeColor: hexToRgba(colEdge.text),
                screenMode: screenModes[screenModeList.selection.index],
                screenAlign: alignList.selection.index,
                screenScaleMode: scaleModeList.selection.index,
                screenScale: parseFloat(editScreenScale.text) || 100,
                screenOffsetX: parseFloat(editOffX.text) || 0,
                screenOffsetY: parseFloat(editOffY.text) || 0,
                targetMode: targetList.selection.index === 0 ? "precomp" : "active",
                shySecondary: shyCheck.value
            };

            buildExtrusionRig(params);
        };

        win.layout.layout(true);
        return win;
    }

    // Launch UI
    var myUI = buildUI(thisObj);
    if (myUI instanceof Window) {
        myUI.center();
        myUI.show();
    }

})(this);
