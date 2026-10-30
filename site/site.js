// Subtle reveal for below-the-fold blocks. Everything is visible without JS,
// under reduced motion, without IntersectionObserver, and after a short timeout.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  root.classList.add('js');
  function showAll() {
    document.querySelectorAll('.reveal').forEach(function (e) { e.classList.add('in'); });
  }
  function run() {
    var els = document.querySelectorAll('.reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.05 });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(showAll, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.addEventListener('beforeprint', showAll);
})();
