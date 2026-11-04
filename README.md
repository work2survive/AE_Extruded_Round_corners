# Extruded Round Corners Maker

**A native 3D/2.5D Extruded Rounded Rectangle Generator & Animator for Adobe After Effects.**

Built as a high-performance alternative to Cinema 4D / Ray-Traced rendering, **Extruded Round Corners Maker** generates mathematically precise 3D rounded rectangles using native 2D segment strips (strictly the needed segment count per 90° corner arc) and independent corner radii. 

Everything is driven by live After Effects expressions parented to a single **Master Controller**, allowing full real-time animation directly on the timeline.

Compatible with **Classic 3D** and **Advanced 3D** (AE 2024+).

---

## 🚀 Key Features

### 1. Pure Classic & Advanced 3D Support
- Works in **Classic 3D**, **Advanced 3D** (AE 2024+), and **Cinema 4D** renderers.
- Screen composition masking is encapsulated inside a self-contained 2D pre-comp wrapper, preventing 3D track-matte breaking in the Advanced 3D engine.
- Renders instantly in real-time, fully compatible with standard AE Cameras and Lights.

### 2. Independent Corner Control & "Link All 4 Corners"
- **Link All 4 Corners (Checkbox)**: When active, all 4 corners automatically take their radius directly from **Radius Top-Left**. You only need to keyframe one slider to animate all corners together!
- **Independent Mode**: When unchecked, dial in separate radii for **Top-Left**, **Top-Right**, **Bottom-Right**, and **Bottom-Left**.
- Built-in proportional clamping ensures corners never self-intersect or invert even if radii exceed the rectangle dimensions.

### 3. Strictly Needed Segments (Zero Bloat, Zero Spiraling)
- The rig generates **strictly the needed number of 2D strips** selected in the UI (e.g. 8, 10, or 12 segments per corner).
- No excess hidden layers, no timeline clutter, and no over-rotation/spiraling.

### 4. Full Extrusion & Depth Control
- **Extruded (Checkbox)**: Instantly switch between a flat 2D custom rounded rectangle and a full 3D extrusion.
- **Extrusion Depth**: Control the depth along the Z-axis. Positive values extrude forward; negative values extrude backward. Keyframeable directly on the timeline!

### 5. Precision Seam & Anti-Clipping Math
- **Anti-Gap Seam Overlap**: Sub-pixel seam overlap (+0.5px) completely eliminates 3D antialiasing edge gaps.
- **Cap Z-Offset (Anti Z-Fighting)**: Offsets cap layers by 0.1px from wall edges, eliminating GPU flickering and coplanar clipping.

### 6. Timeline & Expression Animatable Colors
- Dedicated controls on the Master Controller for:
  - **Cap Top Color**
  - **Cap Bottom Color**
  - **Edge Color**
- Keyframe colors directly on the timeline to create smooth lighting transitions or dynamic palette shifts.
- **Cylindrical Shading Intensity**: Simulates realistic ambient light curvature around the rounded corners even without 3D scene lights.

### 7. Cap as Screen (Composition Playback & Mapping)
- Play and reproduce any composition, footage, or video on the **Top Cap**, **Bottom Cap**, or **Both Caps** (shared or separate comps).
- **Universal 2D Mounted Wrapper**: Operates seamlessly in both Classic 3D and Advanced 3D.
- **9 Alignment Presets**: Center, Top-Left, Top-Center, Top-Right, Center-Left, Center-Right, Bottom-Left, Bottom-Center, Bottom-Right.
- **Scale Modes**:
  - `Auto Fit (Inside)`: Automatically fits the comp within cap bounds preserving aspect ratio.
  - `Auto Fill (Cover)`: Fills the entire cap area, cropping excess.
  - `Stretch`: Stretches to match exact Width & Height.
  - `Manual Scale (%)`: Direct slider control.
- **X / Y Offset**: Fine-tune screen positioning in pixels. Both Scale and Offset are keyframeable on the timeline!

---

## 📦 Installation

### Method A: One-Click Installer Script
1. Open Adobe After Effects.
2. Go to **File > Scripts > Run Script File...**
3. Select `installer/install_script.jsx`.
4. The installer will copy `ExtrudedRoundCornersMaker.jsx` into your `Scripts/ScriptUI Panels/` directory.
5. Restart After Effects. The tool will appear under the **Window** menu.

### Method B: Manual Installation
Copy `ExtrudedRoundCornersMaker.jsx` directly into your After Effects ScriptUI Panels directory:
- **Windows**: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
- **macOS**: `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`

Restart After Effects and open:
**Window > ExtrudedRoundCornersMaker.jsx**

---

## 🎛️ Master Controller Parameter Reference

When a rig is created, all parameters are exposed on the **Master Controller** Null layer under **Effect Controls**:

| Group | Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Geometry** | `Extruded` | Checkbox | `ON` | Toggles 3D extrusion on/off. |
| | `Width` | Slider | `600` | Total rectangle width in pixels (animatable). |
| | `Height` | Slider | `400` | Total rectangle height in pixels (animatable). |
| | `Link All 4 Corners` | Checkbox | `ON` | When ON, all 4 corners use `Radius Top-Left`. |
| | `Radius Top-Left` | Slider | `80` | Master radius when linked, independent TL when unlinked. |
| | `Radius Top-Right` | Slider | `80` | Independent TR radius (when unlinked). |
| | `Radius Bottom-Right`| Slider | `80` | Independent BR radius (when unlinked). |
| | `Radius Bottom-Left` | Slider | `80` | Independent BL radius (when unlinked). |
| **Extrusion** | `Extrusion Depth` | Slider | `60` | Depth along Z. Supports negative values (animatable). |
| | `Seam Overlap (px)` | Slider | `0.5` | Sub-pixel overlap preventing gaps. |
| | `Cap Z-Offset (px)` | Slider | `0.1` | Z-offset preventing Z-fighting. |
| **Colors** | `Cap Top Color` | Color | `#1E88E5` | Color of the front/top cap (animatable). |
| | `Cap Bottom Color` | Color | `#0D47A1` | Color of the back/bottom cap (animatable). |
| | `Edge Color` | Color | `#1565C0` | Base color of the side walls (animatable). |
| | `Shading Intensity` | Slider | `15` | Cylindrical lighting falloff on arcs. |
| **Front Screen**| `Front Screen Enabled` | Checkbox | `OFF/ON` | Toggles front composition playback. |
| | `Front Screen Alignment`| Slider | `0` (Center) | 0: Center, 1: TL, 2: TC, 3: TR, 4: CL, 5: CR, 6: BL, 7: BC, 8: BR. |
| | `Front Screen Offset` | Point | `[0, 0]` | X and Y pixel offset (animatable). |
| | `Front Screen Scale Mode`| Slider | `1` (Fit) | 0: Manual, 1: Fit, 2: Fill, 3: Stretch. |
| | `Front Screen Scale` | Slider | `100%` | Scale percentage (animatable). |
| | `Front Screen Opacity` | Slider | `100%` | Screen opacity (animatable). |
| **Back Screen** | `Back Screen Enabled` | Checkbox | `OFF/ON` | Toggles back composition playback. |
| | `Back Screen Alignment` | Slider | `0` (Center) | Alignment preset for back screen. |
| | `Back Screen Offset` | Point | `[0, 0]` | Back screen X and Y pixel offset (animatable). |
| | `Back Screen Scale Mode`| Slider | `1` (Fit) | Back scale mode. |
| | `Back Screen Scale` | Slider | `100%` | Back scale percentage (animatable). |
| | `Back Screen Opacity` | Slider | `100%` | Back screen opacity (animatable). |

---

## ⚡ Built-in Presets

The ScriptUI panel includes one-click presets for common design assets:
1. **Smartphone Mockup**: 450x920px with 75px radius, 35px depth, front screen active.
2. **Credit / ID Card**: 856x540px with 32px radius, 8px depth, gold finish.
3. **Rounded 3D Tile**: 500x500px with 60px radius, 80px depth, green theme.
4. **UI Button Pill**: 360x100px with 50px radius, 25px depth, vibrant orange gradient.
5. **Sharp Corner Box**: 500x350px with 0px radius, 120px depth.

---



## 📄 License
MIT License. Free to use, modify, and distribute.
