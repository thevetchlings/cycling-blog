async function loadPosts() {
  const [postsRes, ridesRes] = await Promise.all([
    fetch('posts.json'),
    fetch('strava-rides.json').catch(() => null)
  ]);

  const posts = await postsRes.json();

  let autoRides = [];
  if (ridesRes && ridesRes.ok) {
    const ridesData = await ridesRes.json();
    autoRides = ridesData.rides || [];
  }

  const combined = [...posts, ...autoRides];
  combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  return combined;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderEntry(post) {
  const el = document.createElement('article');
  el.className = `entry type-${post.type}`;
  el.dataset.type = post.type;

  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  meta.innerHTML = `
    <span class="entry-tag">${post.type === 'ride' ? 'Ride' : 'Life'}</span>
    <span class="entry-date">${formatDate(post.date)}</span>
  `;
  el.appendChild(meta);

  const title = document.createElement('h2');
  title.className = 'entry-title';
  title.textContent = post.title;
  el.appendChild(title);

  const body = document.createElement('div');
  body.className = 'entry-body';
  (post.body || []).forEach(paragraph => {
    const p = document.createElement('p');
    p.textContent = paragraph;
    body.appendChild(p);
  });
  el.appendChild(body);

  if (post.stats) {
    const bar = document.createElement('div');
    bar.className = 'stats-bar';
    const entries = [
      ['distance', 'Distance'],
      ['elevation', 'Elevation'],
      ['time', 'Time']
    ];
    entries.forEach(([key, label]) => {
      if (post.stats[key]) {
        bar.innerHTML += `
          <div class="stat">
            <span class="stat-value">${post.stats[key]}</span>
            <span class="stat-label">${label}</span>
          </div>`;
      }
    });
    el.appendChild(bar);
  }

  if (post.strava_embed_url) {
    const wrap = document.createElement('div');
    wrap.className = 'embed-wrap';
    wrap.innerHTML = `<iframe height="405" src="${post.strava_embed_url}" scrolling="no" allowtransparency="true" loading="lazy"></iframe>`;
    el.appendChild(wrap);
  }

  if (post.komoot_url) {
    const link = document.createElement('a');
    link.className = 'route-link';
    link.href = post.komoot_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'View route on Komoot →';
    el.appendChild(link);
  }

  if (post.strava_url) {
    const link = document.createElement('a');
    link.className = 'route-link';
    link.href = post.strava_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'View on Strava →';
    el.appendChild(link);
  }

  return el;
}

function applyFilter(filter) {
  document.querySelectorAll('.entry').forEach(el => {
    el.classList.toggle('hidden', filter !== 'all' && el.dataset.type !== filter);
  });
}

(async function init() {
  const posts = await loadPosts();
  const container = document.getElementById('entries');
  posts.forEach(post => container.appendChild(renderEntry(post)));

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      applyFilter(btn.dataset.filter);
    });
  });
})();
