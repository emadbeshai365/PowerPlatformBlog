/* ============================================══
   Emad Beshai &middot; Engineering &mdash; main.js
   ============================================══ */

/* ── 1. Reading progress ── */
const rbar = document.getElementById('rbar');
if (rbar) {
  window.addEventListener('scroll', () => {
    const h = document.body.scrollHeight - innerHeight;
    const p = h > 0 ? (scrollY / h) * 100 : 0;
    rbar.style.width = p + '%';
    rbar.setAttribute('aria-valuenow', Math.round(p));
  }, { passive: true });
}

/* ── 2. Back to top ── */
const backTop = document.getElementById('back-top');
if (backTop) {
  window.addEventListener('scroll', () => {
    backTop.classList.toggle('visible', scrollY > 400);
  }, { passive: true });
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ── 3. Dark mode &mdash; persisted to localStorage ── */
const darkBtn   = document.getElementById('dark-btn');
const themeMeta = document.getElementById('theme-color-meta');
const DARK_KEY  = 'devlog-dark';

function applyDark(on) {
  document.documentElement.toggleAttribute('data-dark', on);
  if (darkBtn) {
    darkBtn.textContent = on ? 'light' : 'dark';
    darkBtn.setAttribute('aria-label', on ? 'Switch to light mode' : 'Switch to dark mode');
    darkBtn.setAttribute('aria-pressed', String(on));
  }
  if (themeMeta) themeMeta.content = on ? '#141310' : '#fafaf8';
}

let dark = localStorage.getItem(DARK_KEY) === 'true';
applyDark(dark);

if (darkBtn) {
  darkBtn.addEventListener('click', () => {
    dark = !dark;
    localStorage.setItem(DARK_KEY, dark);
    applyDark(dark);
  });
}

/* ── 4. Live search (homepage) ── */
const searchEl  = document.getElementById('search');
const entries   = document.querySelectorAll('.post-entry');
const featured  = document.getElementById('featured-post');
const noResults = document.getElementById('no-results');

function runSearch(q) {
  if (!entries.length) return;
  let anyVisible = false;
  if (featured) featured.style.display = (!q || featured.textContent.toLowerCase().includes(q)) ? '' : 'none';
  entries.forEach(e => {
    const show = !q || e.textContent.toLowerCase().includes(q);
    e.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });
  if (noResults) noResults.style.display = (!anyVisible && q) ? 'block' : 'none';
}

if (searchEl) {
  searchEl.addEventListener('input', () => runSearch(searchEl.value.toLowerCase().trim()));
}

/* ── 5. Topic filter ── */
const topicRows = document.querySelectorAll('.topic-row');
const clearBtn  = document.getElementById('clear-filter');

function clearFilter() {
  topicRows.forEach(r => r.setAttribute('aria-pressed', 'false'));
  entries.forEach(e => { e.style.display = ''; });
  if (featured) featured.style.display = '';
  if (noResults) noResults.style.display = 'none';
  if (searchEl) searchEl.value = '';
  if (clearBtn) clearBtn.classList.remove('visible');
}

topicRows.forEach(row => {
  row.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
  });
  row.addEventListener('click', () => {
    if (row.getAttribute('aria-pressed') === 'true') { clearFilter(); return; }
    topicRows.forEach(r => r.setAttribute('aria-pressed', 'false'));
    row.setAttribute('aria-pressed', 'true');
    const topic = row.firstChild.textContent.trim().toLowerCase();
    let anyVisible = false;
    entries.forEach(e => {
      const pills = [...e.querySelectorAll('.pill')].map(p => p.textContent.toLowerCase());
      const show  = pills.some(p => p.includes(topic));
      e.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });
    if (featured) featured.style.display = '';
    if (noResults) noResults.style.display = !anyVisible ? 'block' : 'none';
    if (searchEl) searchEl.value = topic;
    if (clearBtn) clearBtn.classList.add('visible');
  });
});

if (clearBtn) clearBtn.addEventListener('click', clearFilter);

/* ── 6. Newsletter ── */
function handleSub(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  if (!btn) return;
  btn.textContent = 'Subscribed ✓';
  btn.style.background = '#2d6a4f';
  btn.disabled = true;
}
// Expose globally for inline onsubmit handlers
window.handleSub = handleSub;

/* ── 7. TOC active link tracking (post page) ── */
const tocLinks = document.querySelectorAll('.toc-list a');
if (tocLinks.length) {
  const headings = [...document.querySelectorAll('.post-body h2, .post-body h3')];
  const onScroll = () => {
    let current = '';
    headings.forEach(h => {
      if (h.getBoundingClientRect().top < 120) current = h.id;
    });
    tocLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── 8. Copy code buttons ── */
document.querySelectorAll('.post-body pre').forEach(pre => {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.setAttribute('aria-label', 'Copy code');
  btn.textContent = 'copy';
  pre.style.position = 'relative';
  pre.appendChild(btn);
  btn.addEventListener('click', () => {
    const code = pre.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.innerText).then(() => {
      btn.textContent = 'copied ✓';
      setTimeout(() => { btn.textContent = 'copy'; }, 2000);
    });
  });
});

/* ── 9. Share buttons (post page) ── */
document.querySelectorAll('[data-share]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-share');
    const url    = encodeURIComponent(location.href);
    const title  = encodeURIComponent(document.title);
    if (action === 'twitter') window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank', 'noopener');
    if (action === 'linkedin') window.open(`https://linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener');
    if (action === 'copy') {
      navigator.clipboard.writeText(location.href).then(() => {
        btn.textContent = 'copied ✓';
        setTimeout(() => { btn.textContent = 'copy link'; }, 2000);
      });
    }
  });
});
