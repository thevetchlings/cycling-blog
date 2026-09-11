// Config: your repo details
const REPO_OWNER = 'thevetchlings';
const REPO_NAME = 'cycling-blog';
const REPO_BRANCH = 'main';
const FILE_PATH = 'posts.json';

const TOKEN_KEY = 'waypoints_github_token';

// ---- Unicode-safe base64 helpers ----
function b64EncodeUnicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function b64DecodeUnicode(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---- Token handling ----
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function refreshTokenUI() {
  const hasToken = !!getToken();
  document.getElementById('tokenPrompt').style.display = hasToken ? 'none' : 'block';
  document.getElementById('tokenConnected').style.display = hasToken ? 'block' : 'none';
}

document.getElementById('saveTokenBtn').addEventListener('click', () => {
  const val = document.getElementById('tokenInput').value.trim();
  if (!val) return;
  setToken(val);
  document.getElementById('tokenInput').value = '';
  refreshTokenUI();
});

document.getElementById('forgetTokenBtn').addEventListener('click', () => {
  clearToken();
  refreshTokenUI();
});

// ---- Show/hide ride-only fields ----
const typeSelect = document.getElementById('type');
function updateFieldsForType() {
  const isRide = typeSelect.value === 'ride';
  document.getElementById('statsFields').classList.toggle('hidden', !isRide);
  document.getElementById('komootField').style.display = isRide ? 'block' : 'none';
}
typeSelect.addEventListener('change', updateFieldsForType);
updateFieldsForType();

// Default date to today
document.getElementById('date').valueAsDate = new Date();

// ---- Status message ----
function showStatus(message, kind) {
  const el = document.getElementById('statusMsg');
  el.textContent = message;
  el.className = `status-msg ${kind}`;
}

// ---- GitHub API calls ----
async function fetchCurrentPosts(token) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${REPO_BRANCH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) {
    throw new Error(res.status === 401
      ? 'GitHub rejected the token — check it was copied correctly and has the right permissions.'
      : `Couldn't read posts.json (${res.status}).`);
  }
  const data = await res.json();
  const posts = JSON.parse(b64DecodeUnicode(data.content));
  return { posts, sha: data.sha };
}

async function commitPosts(token, posts, sha, commitMessage) {
  const content = b64EncodeUnicode(JSON.stringify(posts, null, 2) + '\n');
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ message: commitMessage, content, sha, branch: REPO_BRANCH })
    }
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || `Couldn't save the entry (${res.status}).`);
  }
}

// ---- Form submit ----
document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = getToken();
  if (!token) {
    showStatus('Paste your GitHub token above first.', 'error');
    return;
  }

  const type = typeSelect.value;
  const date = document.getElementById('date').value;
  const title = document.getElementById('title').value.trim();
  const bodyText = document.getElementById('body').value.trim();
  const body = bodyText ? bodyText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];

  const entry = { type, date, title, body };

  if (type === 'ride') {
    const distance = document.getElementById('distance').value.trim();
    const elevation = document.getElementById('elevation').value.trim();
    const time = document.getElementById('time').value.trim();
    if (distance || elevation || time) {
      entry.stats = {};
      if (distance) entry.stats.distance = distance;
      if (elevation) entry.stats.elevation = elevation;
      if (time) entry.stats.time = time;
    }
    const komoot = document.getElementById('komoot').value.trim();
    if (komoot) entry.komoot_url = komoot;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  showStatus('Publishing…', 'success');

  try {
    const { posts, sha } = await fetchCurrentPosts(token);
    posts.push(entry);
    await commitPosts(token, posts, sha, `Add entry: ${title}`);
    showStatus('Published! The live site will update in about a minute.', 'success');
    document.getElementById('entryForm').reset();
    document.getElementById('date').valueAsDate = new Date();
    updateFieldsForType();
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

refreshTokenUI();
