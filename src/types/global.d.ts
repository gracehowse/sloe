declare module "*.css" {
  const content: string;
  export default content;
}

declare module "canvas-confetti" {
  interface Options {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    disableForReducedMotion?: boolean;
  }
  function confetti(options?: Options): Promise<null>;
  export default confetti;
}

