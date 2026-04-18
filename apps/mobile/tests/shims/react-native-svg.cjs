/**
 * `react-native-svg` CJS shim — stubbed no-ops. The real module relies
 * on native components + `processColor`/`Touchable.Mixin` that the
 * vitest `react-native` shim deliberately doesn't provide. Tests never
 * render charts, so every export resolves to a trivial host-forwarder.
 *
 * CJS (not TSX) for the same reason the RN shim is CJS — Node's loader
 * runs before vite-node can transform the file, so it must be
 * syntactically-valid Node JS from byte one.
 */
"use strict";

const React = require("react");

function stub(name) {
  const Cmp = React.forwardRef(function SvgStub(props, ref) {
    const p = props || {};
    return React.createElement(
      "View",
      Object.assign({}, p, { ref: ref, "data-svg-stub": name }),
      p.children,
    );
  });
  Cmp.displayName = name;
  return Cmp;
}

const exportsObj = {
  Svg: stub("Svg"),
  Circle: stub("Circle"),
  Ellipse: stub("Ellipse"),
  G: stub("G"),
  Line: stub("Line"),
  Path: stub("Path"),
  Polygon: stub("Polygon"),
  Polyline: stub("Polyline"),
  Rect: stub("Rect"),
  Text: stub("Text"),
  TSpan: stub("TSpan"),
  TextPath: stub("TextPath"),
  Use: stub("Use"),
  Defs: stub("Defs"),
  Stop: stub("Stop"),
  LinearGradient: stub("LinearGradient"),
  RadialGradient: stub("RadialGradient"),
  ClipPath: stub("ClipPath"),
  Pattern: stub("Pattern"),
  Mask: stub("Mask"),
  ForeignObject: stub("ForeignObject"),
  Symbol: stub("Symbol"),
  Marker: stub("Marker"),
  Image: stub("Image"),
};

module.exports = exportsObj;
module.exports.default = exportsObj.Svg;
