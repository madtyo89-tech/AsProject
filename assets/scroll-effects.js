/* Shared one-shot section reveals for Studio, floating preview and live invitations. */
(function () {
 const observers = new WeakMap();
 window.clearScrollReveal = container => {
  observers.get(container)?.disconnect();
  observers.delete(container);
 };
 window.setupScrollReveal = function (container, root = null) {
  if (!container) return;
  window.clearScrollReveal(container);
  const sections = container.querySelectorAll('.scroll-reveal');
  sections.forEach(el => el.classList.remove('sr-ready', 'sr-in'));
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (motion?.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
   entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    target.classList.add('sr-in');
    observer.unobserve(target);
   });
  }, { root, threshold: 0, rootMargin: '0px 0px -12px 0px' });
  observers.set(container, observer);
  sections.forEach(el => { el.classList.add('sr-ready'); observer.observe(el); });
 };
})();
