"use client";

import * as React from "react";
import {
  calorieRingGeometryForViewport,
  type CalorieRingGeometry,
} from "../nutrition/calorieRingGeometry";

/** Responsive Sloe ring size — mirrors mobile `Dimensions.get("window").width`. */
export function useCalorieRingGeometry(fallbackWidth = 390): CalorieRingGeometry {
  const [geometry, setGeometry] = React.useState(() =>
    calorieRingGeometryForViewport(fallbackWidth),
  );

  React.useEffect(() => {
    const update = () => setGeometry(calorieRingGeometryForViewport(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return geometry;
}
