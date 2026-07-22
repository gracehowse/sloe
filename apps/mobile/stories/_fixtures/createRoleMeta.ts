import type { Meta } from "@storybook/react";
import type { ComponentType } from "react";

import { withMobileStorybookTheme } from "./mobileStoryDecorators";
import { ROLE_DOCS } from "./roleDocs";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

export function createMobileRoleMeta<const TRole extends keyof typeof ROLE_DOCS>({
  title,
  component,
  role,
}: {
  title: `Mobile/Roles/${string}`;
  component?: ComponentType;
  role: TRole;
}): Meta {
  return {
    title,
    component,
    decorators: [withMobileStorybookTheme],
    parameters: {
      ...chromaticVisualContract.parameters,
      layout: "centered",
      a11y: {
        // RN-web catalog — primitive a11y gaps (spinner labels, Notice checkbox)
        // are tracked on the components; Chromatic guards pixels first (ENG-1664).
        test: "off",
      },
      docs: {
        description: {
          component: ROLE_DOCS[role],
        },
      },
    },
    // CSF requires string-literal tags (cannot spread imported constants).
    tags: ["mobile-role", "chromatic"],
  };
}
