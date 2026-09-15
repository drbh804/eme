const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const shown = new WeakSet();

function splitWords(el) {
  if (el.dataset.split === 'done') return;
  el.dataset.split = 'done';
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const text = child.textContent;
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        text.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (!tok.trim()) { frag.appendChild(document.createTextNode(tok)); return; }
          const s = document.createElement('span');
          s.setAttribute('data-w', '');
          s.textContent = tok;
          frag.appendChild(s);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        walk(child);
      }
    });
  };
  walk(el);
}

function countUp(el) {
  if (el.dataset.counted) return;
  const m = el.textContent.trim().match(/^(\D*)(\d+)(\D*)$/);
  if (!m) return;
  const [, pre, num, post] = m;
  const target = parseInt(num, 10);
  if (!target || target > 100000) return;
  el.dataset.counted = '1';
  const dur = 1100, t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = pre + Math.round(target * (1 - Math.pow(1 - p, 3))) + post;
    if (p < 1) requestAnimationFrame(tick);
  };
  el.textContent = pre + '0' + post;
  requestAnimationFrame(tick);
}

const SEL = '[data-split], [data-reveal], [data-scale]';

// Reveal state lives in a data attribute + a WeakSet, never in className —
// React rewrites className on re-render and would wipe it.
function reveal(el, stagger) {
  shown.add(el);
  if (el.hasAttribute('data-split')) {
    el.querySelectorAll('[data-w]').forEach((w, i) => {
      if (stagger) w.style.transitionDelay = (i * 55) + 'ms';
      w.setAttribute('data-in', '');
    });
    return;
  }
  el.setAttribute('data-in', '');
  if (el.hasAttribute('data-count')) countUp(el);
  el.querySelectorAll('[data-count]').forEach(countUp);
}

export function initMotion(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = root.querySelector('[data-page]');
  if (!host) return;
  host.setAttribute('data-motion', '');

  if (!host.__io) {
    host.__io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) reveal(e.target, true); });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }

  const scan = () => {
    const vh = window.innerHeight;
    host.querySelectorAll(SEL).forEach((el) => {
      if (el.hasAttribute('data-split')) splitWords(el);
      if (shown.has(el)) { reveal(el, false); return; } // re-assert after a React wipe
      if (!el.dataset.moSeen) {
        el.dataset.moSeen = '1';
        if (el.hasAttribute('data-reveal')) {
          const g = el.parentElement;
          const i = g ? Array.prototype.indexOf.call(g.children, el) : 0;
          el.style.transitionDelay = Math.min(i, 6) * 80 + 'ms';
        }
        host.__io.observe(el);
      }
      // catch-up: anything already at or above the fold reveals now
      if (el.getBoundingClientRect().top < vh * 0.94) reveal(el, true);
    });
  };

  host.__scan = scan;
  scan();

  if (!host.__bound) {
    host.__bound = true;
    let t;
    const queue = () => { clearTimeout(t); t = setTimeout(scan, 80); };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    new MutationObserver(queue).observe(host, { childList: true, subtree: true });
  }
}

export const MOTION_CSS = `
  [data-motion] [data-reveal] { opacity: 0; transform: translateY(26px); transition: opacity 0.9s ${EASE}, transform 0.9s ${EASE}; }
  [data-motion] [data-reveal][data-in] { opacity: 1; transform: none; }
  [data-motion] [data-w] { display: inline-block; opacity: 0; transform: translateY(0.55em); transition: opacity 0.75s ${EASE}, transform 0.75s ${EASE}; }
  [data-motion] [data-w][data-in] { opacity: 1; transform: none; }
`;
