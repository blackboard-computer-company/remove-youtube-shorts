(function () {
  'use strict';

  document.documentElement.classList.add('remove-youtube-shorts');

  function redirectHomepage() {
    if (window.location.pathname === '/') {
      // Replace the homepage so Back does not send you into a redirect loop.
      window.location.replace('https://www.youtube.com/feed/subscriptions');
    }
  }

  redirectHomepage();
  // YouTube also navigates without loading a new document (e.g. its Home logo).
  document.addEventListener('yt-navigate-finish', redirectHomepage);
})();
