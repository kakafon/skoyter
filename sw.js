// Minimal service worker — kun til bruk for å vise varsler via
// registration.showNotification(), siden Android Chrome/Vivaldi (og de fleste
// mobilnettlesere) ikke støtter den enkle `new Notification()`-konstruktøren.
// Gjør ingenting med nettverkstrafikk eller caching.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
