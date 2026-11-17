(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;
  const revealNodes = document.querySelectorAll('.hero-copy > *, .invitation-scene, .letter-copy > *, .section-heading, .event-details .detail, .directions-copy > *, .map-card, .arrival-steps article, .building-note, .guestbook-copy, .wish-form, .wish-wall-heading, .closing > *');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });
    revealNodes.forEach((node, index) => {
      node.classList.add('reveal-item');
      node.style.setProperty('--reveal-delay', `${(index % 3) * 85}ms`);
      observer.observe(node);
    });
    window.setTimeout(() => document.querySelectorAll('.hero-copy .reveal-item, .invitation-scene').forEach(n => n.classList.add('is-visible')), 100);
  }
  const scene = document.querySelector('[data-tilt-scene]');
  const card = scene?.querySelector('.invitation-card');
  if (scene && card && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0;
    scene.addEventListener('pointermove', (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = scene.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty('--tilt-x', `${(0.5 - y) * 11}deg`);
        card.style.setProperty('--tilt-y', `${(x - 0.5) * 13}deg`);
        card.style.setProperty('--shine-x', `${x * 100}%`);
        card.style.setProperty('--shine-y', `${y * 100}%`);
        scene.classList.add('is-hovering');
      });
    });
    scene.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      scene.classList.remove('is-hovering');
      card.style.setProperty('--tilt-x', '0deg'); card.style.setProperty('--tilt-y', '0deg');
    });
  }
  const progress = document.getElementById('reading-progress');
  let scrolling = false;
  const update = () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0})`;
    scrolling = false;
  };
  window.addEventListener('scroll', () => { if (!scrolling) { scrolling = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
