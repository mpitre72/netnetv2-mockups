// Centralized icon + logo configs for Net Net UI chrome and social networks.
// Reuses the authoritative URLs already defined in app-constants.js.
import { LOGO_ASSETS, ICONS } from './app-constants.js';
import { TIMER_ICONS } from './app-constants.js';

export const netnetLogos = {
  light: { ...LOGO_ASSETS.light },
  dark: { ...LOGO_ASSETS.dark },
};

export const navIcons = {
  me: { ...ICONS.me },
  contacts: { ...ICONS.contacts },
  sales: { ...ICONS.sales },
  jobs: { ...ICONS.jobs },
  quickTasks: { ...ICONS.quick },
  quick: { ...ICONS.quick },
  chat: { ...ICONS.chat },
  performance: { ...ICONS.performance },
  reports: { ...ICONS.reports }, // legacy alias
  netNetU: { ...ICONS.nnu },
  nnu: { ...ICONS.nnu },
  bot: { ...ICONS.bot },
};

export const timeIcons = {
  idle: TIMER_ICONS.idle,
  active: TIMER_ICONS.active,
};

// Simple monochrome SVG data URIs so they can inherit text color for light/dark.
const svgIcon = (path) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${path}</svg>`
  )}`;

const linkedInPath = '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-.75 7.5h2.98v9.5H4.23v-9.5Zm6.23 0h2.85v1.41h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6v5.05h-2.98v-4.47c0-1.07-.02-2.45-1.5-2.45-1.51 0-1.74 1.18-1.74 2.38v4.54H10.5v-9.5Z"/>';
const xPath = '<path d="M4 4h4.8l2.83 3.74L14.87 4H20l-5.73 6.3L20 20h-4.8l-3.13-4.13L8.86 20H4l5.88-6.49L4 4Zm3.05 1.5 9.65 12h1.9L8.95 5.5h-1.9Z"/>';
const facebookPath = '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/>';
const instagramPath = '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm12.25 1.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2.25A1.75 1.75 0 1 0 13.75 12 1.75 1.75 0 0 0 12 10.25Z"/>';
const youtubePath = '<path d="M10 9.5 15.5 12 10 14.5v-5ZM3.5 5h17a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-17a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"/>';
const tiktokPath = '<path d="M21 8.33a5.46 5.46 0 0 1-3.33-1.11v6.07a5.71 5.71 0 1 1-5.71-5.71 6 6 0 0 1 .71 0v3.17a2.76 2.76 0 1 0 2 2.65V2h3a5.45 5.45 0 0 0 3.33 1.14Z"/>';
const whatsappPath = '<path d="M20.52 3.48A11.86 11.86 0 0 0 12 0a12 12 0 0 0-10.2 18.32L0 24l5.8-1.77A12 12 0 0 0 24 12a11.86 11.86 0 0 0-3.48-8.52ZM12 21.68a9.66 9.66 0 0 1-4.92-1.36l-.35-.21-3.45 1 1-3.35-.23-.35A9.69 9.69 0 1 1 12 21.68Zm5.3-7.26c-.3-.15-1.78-.88-2.05-.98s-.48-.15-.68.15-.78.98-.95 1.18-.35.22-.65.07a7.91 7.91 0 0 1-2.34-1.44 8.77 8.77 0 0 1-1.62-2c-.17-.3 0-.46.13-.61s.3-.35.45-.52a2 2 0 0 0 .3-.5.54.54 0 0 0 0-.52c-.08-.15-.68-1.61-.93-2.22s-.5-.52-.68-.53h-.58a1.12 1.12 0 0 0-.8.37A3.35 3.35 0 0 0 6 9.1 5.82 5.82 0 0 0 7.21 12a13.28 13.28 0 0 0 5.08 5 5.93 5.93 0 0 0 3.48 1.1 3 3 0 0 0 2-.78 2.56 2.56 0 0 0 .55-1.6c.07-.16.07-.29.05-.32s-.12-.1-.3-.2Z"/>';
const snapchatPath = '<path d="M12 2c2.9 0 5.7 2 5.7 6.3 0 1-.1 1.8-.1 2.1 0 .2.2.4.4.5 1.2.6 2.4 1.2 3 1.5.3.2.5.5.4.8-.1.4-.7.5-1.3.7-.6.2-1.2.5-1.1.9 0 .3.3.6 1.2.7.6.1.8.6.6 1-.4.7-1.7 1.3-3.4 1.5-.1 0-.2.1-.2.2-.2.6-.6 1.3-1 1.3-.4 0-.8-.3-1.3-.6-.6-.4-1.3-.8-2.9-.8h-.5c-1.6 0-2.3.4-2.9.8-.5.3-.9.6-1.3.6-.4 0-.8-.7-1-1.3 0-.1-.1-.2-.2-.2-1.7-.2-3-1-3.4-1.5-.3-.4-.1-.9.6-1 .9-.1 1.2-.4 1.2-.7 0-.4-.6-.7-1.1-.9-.7-.2-1.2-.3-1.3-.7-.1-.3.1-.6.4-.8.6-.3 1.8-.9 3-1.5.2-.1.4-.3.4-.5 0-.4-.1-1.1-.1-2.1C6.3 4 9.1 2 12 2Z"/>';
const threadsPath = '<path d="M18.944 15.202c-.218-.142-.44-.278-.664-.408a5.137 5.137 0 0 0 .258-1.548c.054-1.557-.364-2.928-1.205-4.08-1.003-1.374-2.476-2.236-4.372-2.558-.458-.077-.923-.115-1.384-.112-1.8.008-3.296.504-4.448 1.474C5.941 9.27 5.39 10.617 5.39 12.42c0 1.664.513 3.043 1.526 4.094 1.033 1.073 2.47 1.653 4.271 1.716.074.003.147.005.222.005 1.66 0 3.049-.467 4.138-1.387a4.38 4.38 0 0 0 1.419-2.483h-2.5c-.132.382-.38.72-.722.97-.47.35-1.094.526-1.855.526-.07 0-.142-.002-.214-.005-1.149-.045-1.953-.38-2.541-1.039-.403-.453-.633-1.07-.69-1.871h7.262c.125-.71.185-1.423.185-2.132 0-.034-.001-.067-.002-.101.341.223.667.468.973.734.923.809 1.403 1.77 1.403 2.858 0 2.028-1.47 3.44-3.824 3.44h-.002c-.632 0-1.216-.094-1.738-.28l-.536 2.07c.7.22 1.45.33 2.238.33h.004c1.45 0 2.772-.324 3.83-.937 1.603-.918 2.506-2.544 2.506-4.458 0-1.632-.67-3.025-1.994-4.1Z"/>';
const redditPath = '<path d="M22 12.36c0-.98-.8-1.78-1.78-1.78-.48 0-.92.19-1.24.5-1.22-.87-2.86-1.42-4.67-1.5l.94-4.43 3.08.65c0 1 1.13 1.5 1.83.8.77-.77.2-2.07-.88-2.07-.62 0-1.12.4-1.3.95l-3.43-.72c-.23-.05-.45.1-.5.32l-1.04 4.9c-1.87.07-3.56.62-4.82 1.5-.32-.32-.77-.5-1.24-.5-.98 0-1.78.8-1.78 1.78 0 .73.43 1.34 1.04 1.62-.03.18-.04.36-.04.55 0 2.65 2.82 4.8 6.29 4.8 3.47 0 6.29-2.15 6.29-4.8 0-.18-.01-.37-.04-.55.6-.28 1.04-.9 1.04-1.62Zm-13.5.41c0-.78.64-1.41 1.42-1.41.78 0 1.41.63 1.41 1.41 0 .78-.63 1.41-1.41 1.41-.78 0-1.42-.63-1.42-1.41Zm7.55 3.18c-.86.86-2.43.93-2.99.93-.56 0-2.13-.07-2.99-.93-.13-.13-.13-.35 0-.48.13-.13.35-.13.48 0 .55.55 1.72.75 2.51.75.79 0 1.97-.2 2.51-.75.13-.13.35-.13.48 0 .14.13.14.35 0 .48Zm-.1-1.77c-.78 0-1.41-.63-1.41-1.41 0-.78.63-1.41 1.41-1.41.78 0 1.42.63 1.42 1.41 0 .78-.64 1.41-1.42 1.41Z"/>';
const pinterestPath = '<path d="M12.04 2C7.12 2 4 5.46 4 9.35c0 1.82.77 3.41 2.43 4 0 .11-.09.5-.11.61-.05.27-.21 1.1-.91 3.75 0 0-.02.11 0 .14a.33.33 0 0 0 .25.11c.1 0 .21-.05.26-.1.12-.14 1.71-1.78 2.31-2.4.18-.18.35-.24.52-.24.26 0 .53.12.81.24.52.21 1.12.46 2 .46 3.9 0 6.96-3.05 6.96-6.96C18.52 5.23 15.63 2 12.04 2Zm.28 11.68c-.56 0-1.11-.12-1.53-.32-.19-.08-.4-.21-.59-.21-.23 0-.43.13-.63.32-.1.1-.27.27-.48.48l-.16.17.05-.22c.11-.5.22-1 .28-1.27l.04-.2c.02-.09 0-.2-.13-.25-1.39-.6-2.05-1.8-2.05-3.14 0-2.6 1.96-4.95 5.34-4.95 2.86 0 4.94 2.16 4.94 5.02 0 2.85-2.03 5.57-4.98 5.57Z"/>';
const globePath = '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />';
const emailPath = '<rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><path d="m3 7 9 6 9-6"/>';

export const socialIcons = {
  linkedin: { light: svgIcon(linkedInPath), dark: svgIcon(linkedInPath) },
  x: { light: svgIcon(xPath), dark: svgIcon(xPath) },
  facebook: { light: svgIcon(facebookPath), dark: svgIcon(facebookPath) },
  instagram: { light: svgIcon(instagramPath), dark: svgIcon(instagramPath) },
  youtube: { light: svgIcon(youtubePath), dark: svgIcon(youtubePath) },
  tiktok: { light: svgIcon(tiktokPath), dark: svgIcon(tiktokPath) },
  whatsapp: { light: svgIcon(whatsappPath), dark: svgIcon(whatsappPath) },
  snapchat: { light: svgIcon(snapchatPath), dark: svgIcon(snapchatPath) },
  threads: { light: svgIcon(threadsPath), dark: svgIcon(threadsPath) },
  reddit: { light: svgIcon(redditPath), dark: svgIcon(redditPath) },
  pinterest: { light: svgIcon(pinterestPath), dark: svgIcon(pinterestPath) },
  website: { light: svgIcon(globePath), dark: svgIcon(globePath) },
  personalWebsite: { light: svgIcon(globePath), dark: svgIcon(globePath) },
  email: { light: svgIcon(emailPath), dark: svgIcon(emailPath) },
};
