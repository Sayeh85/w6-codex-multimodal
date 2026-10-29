const state = { files: [null, null], urls: [null, null] };
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const button = $('describeBtn');
function setStatus(message, kind = '') { statusEl.textContent = message; statusEl.className = `status ${kind}`.trim(); }
function clearResult(index) { $('result' + (index + 1)).innerHTML = '<span class="result-label">AI DESCRIPTION</span><p class="placeholder">' + (index === 0 ? 'Your image description will appear here.' : 'Add a second image to describe it separately.') + '</p>'; }
function setFile(index, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { setStatus('Please choose a valid image file.', 'error'); return; }
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files[index] = file; state.urls[index] = URL.createObjectURL(file);
  $('preview' + (index + 1)).src = state.urls[index];
  $('name' + (index + 1)).textContent = file.name;
  $('previewWrap' + (index + 1)).hidden = false;
  $('dropzone' + (index + 1)).hidden = true;
  clearResult(index); setStatus('Image selected. Ready to describe.', 'success');
}
function clearFile(index) {
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files[index] = null; state.urls[index] = null;
  $('image' + (index + 1)).value = ''; $('preview' + (index + 1)).removeAttribute('src');
  $('previewWrap' + (index + 1)).hidden = true; $('dropzone' + (index + 1)).hidden = false;
  clearResult(index); setStatus(state.files.some(Boolean) ? 'Image removed.' : 'Select at least one image to get started.');
}
[0,1].forEach(i => {
  $('image' + (i + 1)).addEventListener('change', e => setFile(i, e.target.files[0]));
  $('dropzone' + (i + 1)).addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('dragging'); });
  $('dropzone' + (i + 1)).addEventListener('dragleave', e => e.currentTarget.classList.remove('dragging'));
  $('dropzone' + (i + 1)).addEventListener('drop', e => { e.preventDefault(); e.currentTarget.classList.remove('dragging'); setFile(i, e.dataTransfer.files[0]); });
  document.querySelector(`[data-clear="${i+1}"]`).addEventListener('click', () => clearFile(i));
});
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read ' + file.name)); reader.readAsDataURL(file);
  });
}
async function describe(index, model) {
  const file = state.files[index];
  const result = $('result' + (index + 1));
  result.innerHTML = '<span class="result-label">AI DESCRIPTION</span><p>Analyzing image…</p>';
  const image = await fileToBase64(file);
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: 'Describe this image clearly and accurately. Mention the main subjects, setting, visible details, colors, and composition. Do not invent details that are not visible.', images: [image], stream: false })
  });
  if (!response.ok) {
    let detail = ''; try { detail = (await response.json()).error || ''; } catch (_) {}
    throw new Error(detail || `Ollama returned HTTP ${response.status}.`);
  }
  const data = await response.json();
  if (!data.response) throw new Error('The model returned an empty description.');
  result.innerHTML = '<span class="result-label">AI DESCRIPTION</span><p></p>';
  result.querySelector('p').textContent = data.response.trim();
}
button.addEventListener('click', async () => {
  const indexes = state.files.map((file, i) => file ? i : -1).filter(i => i >= 0);
  if (!indexes.length) { setStatus('Please select at least one image first.', 'error'); return; }
  const model = $('model').value; button.disabled = true; button.querySelector('span').textContent = 'Analyzing…';
  setStatus('Connecting to Ollama. This may take a moment on the first run…');
  try {
    // Run sequentially to reduce memory pressure on local vision models.
    for (const index of indexes) await describe(index, model);
    setStatus(`Successfully described ${indexes.length} image${indexes.length > 1 ? 's' : ''}.`, 'success');
  } catch (error) {
    const message = error.message.includes('Failed to fetch')
      ? 'Could not connect to Ollama. Start Ollama, pull the selected vision model, and try again.' : error.message;
    setStatus(message, 'error');
    indexes.forEach(i => { const p = $('result' + (i + 1)).querySelector('p'); if (p && p.textContent === 'Analyzing image…') p.textContent = 'Description failed. Check the status message below and try again.'; });
  } finally { button.disabled = false; button.querySelector('span').textContent = 'Describe image(s)'; }
});
