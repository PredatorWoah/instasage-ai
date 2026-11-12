// Opens the Sage chat from anywhere and asks it something, e.g. "Explain this chart"
export const ASK_SAGE = 'instasage:ask-sage';

export function askSage(message?: string) {
  window.dispatchEvent(new CustomEvent(ASK_SAGE, { detail: message ?? '' }));
}
