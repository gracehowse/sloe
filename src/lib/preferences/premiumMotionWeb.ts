"use client";

import { isFeatureEnabled } from "../analytics/track";
import { PREMIUM_MOTION_V1_FLAG } from "./premiumMotion";

export function isPremiumMotionV1Enabled(): boolean {
  return isFeatureEnabled(PREMIUM_MOTION_V1_FLAG);
}
