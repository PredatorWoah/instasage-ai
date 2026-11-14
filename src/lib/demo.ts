// The demo account: made-up data for a made-up brand, read-only, no AI and no Instagram.
// Shared by the server and the browser, so it holds nothing secret.

export const DEMO_ID = 'demo';
export const DEMO_PROFILE_ID = 'demo-profile';
export const DEMO_MESSAGE = 'This is the demo, so changes are switched off. Nothing here is real.';
export const DEMO_AI_MESSAGE = 'AI is switched off in the demo. What you see here are saved examples.';

export const isDemo = (userId: string | null | undefined) => userId === DEMO_ID;

// The demo can be turned off with DEMO=off in the hosting settings
export const demoEnabled = () => process.env.DEMO?.trim().toLowerCase() !== 'off';
