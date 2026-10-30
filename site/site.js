// Subtle reveal-on-scroll. Pages are fully visible without it.
(function () {
  document.documentElement.classList.add('js');
  function run() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }
  document.addEventListener('DOMContentLoaded', run);
})();
