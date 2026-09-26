/* Runs in <head>: flags JS and reduced motion before first paint and reveals content if the animation libraries fail. */
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) root.classList.add('reduced');
  // Safety net: if the animation libraries fail to load, show everything after 2.5 s.
  window.setTimeout(function () {
    if (window.__snipflagReady) return;
    root.classList.remove('js');
    root.classList.add('reduced');
  }, 2500);
})();
