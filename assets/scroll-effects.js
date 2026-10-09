/* Shared repeatable scroll reveals for Studio previews and published invitations. */
(function () {
 const installs = new WeakMap();
 const readScroll = root => root
  ? (root.scrollTop || 0)
  : (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0);

 window.clearScrollReveal = container => {
  const install=installs.get(container);
  if(!install)return;
  install.observer.disconnect();
  install.scrollTarget.removeEventListener('scroll',install.onScroll);
  installs.delete(container);
 };

 window.setupScrollReveal = function (container, root = null) {
  if (!container) return;
  window.clearScrollReveal(container);
  const sections = container.querySelectorAll('.scroll-reveal');
  sections.forEach(el => el.classList.remove('sr-ready', 'sr-in', 'sr-dir-up', 'sr-dir-down'));
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (motion?.matches || !('IntersectionObserver' in window)) return;

  const scrollTarget=root||window;
  let lastPosition=readScroll(root),direction='down';
  const onScroll=()=>{
   const position=readScroll(root);
   if(position<lastPosition)direction='up';
   else if(position>lastPosition)direction='down';
   lastPosition=position;
  };
  scrollTarget.addEventListener('scroll',onScroll,{passive:true});

  const observer = new IntersectionObserver(entries => {
   entries.forEach(({ target, isIntersecting }) => {
    if(isIntersecting){
     if(target.classList.contains('sr-in'))return;
     target.classList.remove('sr-dir-up','sr-dir-down');
     target.classList.add(direction==='up'?'sr-dir-up':'sr-dir-down');
     target.classList.add('sr-in');
    }else{
     /* Hide off-screen sections so they can reveal again when scrolling back. */
     target.classList.remove('sr-in');
    }
   });
  }, { root, threshold: 0, rootMargin: '0px 0px -12px 0px' });
  installs.set(container,{observer,scrollTarget,onScroll});
  sections.forEach(el => { el.classList.add('sr-ready'); observer.observe(el); });
 };
})();
