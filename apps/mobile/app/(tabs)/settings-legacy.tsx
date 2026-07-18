/**
 * Flag-off compatibility route for the pre-ENG-1376 tab-owned Settings path.
 * The canonical screen lives at `/settings`; remove this wrapper when
 * `bottom_chrome_contract_v1` is retired after rollout.
 */
export { default } from "../settings";
