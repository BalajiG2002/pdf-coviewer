// Static/script.js

// Generate a short random ID to distinguish this browser tab in chat
const CHAT_USER = 'User-' + Math.random().toString(36).slice(2, 6).toUpperCase();
let socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
});

let pdfDoc = null;
let pageNum = 1;
let zoomLevel = 1.5;
let isAdmin = IS_ADMIN;
let shareUrl = null;
let laserEnabled = false;
let pointerHideTimer = null;

// Page rendering cache (Task 2.2)
const pageCache = new Map();

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// ---------------------------------------------------------------------------
// DOM element references
// ---------------------------------------------------------------------------
const canvas          = document.getElementById('pdf-viewer');
const ctx             = canvas.getContext('2d');
const pointerOverlay  = document.getElementById('pointer-overlay');
const pointerCtx      = pointerOverlay.getContext('2d');
const prevButton      = document.getElementById('prev-page');
const nextButton      = document.getElementById('next-page');
const pageInfo        = document.getElementById('page-info');
const fileInput       = document.getElementById('pdf-upload');
const userCount       = document.getElementById('user-count');
const connectionStatus = document.getElementById('connection-status');
const roleIndicator   = document.getElementById('role-indicator');
const shareUrlSection = document.getElementById('share-url-section');
const shareUrlInput   = document.getElementById('share-url');
const zoomLevelElem   = document.getElementById('zoom-level');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage    = document.getElementById('error-message');
const laserToggle     = document.getElementById('laser-toggle');
const chatSidebar     = document.getElementById('chat-sidebar');
const chatMessages    = document.getElementById('chat-messages');
const chatInput       = document.getElementById('chat-input');

// ---------------------------------------------------------------------------
// WebSocket connection
// ---------------------------------------------------------------------------
socket.on('connect', () => {
    connectionStatus.textContent = '🟢 Connected';
    socket.emit('join_session', { session_id: SESSION_ID, is_admin: isAdmin });
});

socket.on('disconnect', () => {
    connectionStatus.textContent = '🔴 Disconnected';
});

// Re-join room after automatic reconnect (Task 2.3)
socket.on('reconnect', () => {
    socket.emit('join_session', {
        session_id: SESSION_ID,
        is_admin: isAdmin,
        page: pageNum,
    });
});

// ---------------------------------------------------------------------------
// File upload (with CSRF token – Task 1.3)
// ---------------------------------------------------------------------------
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showError('Only PDF files are supported.');
        return;
    }

    showLoading('Uploading PDF...');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('session_id', SESSION_ID);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            headers: { 'X-CSRFToken': CSRF_TOKEN },
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            shareUrl = data.session_url;
            showShareUrl();
            await loadPDFFromServer();
        } else {
            let errMsg = 'Upload failed';
            try {
                const errData = await response.json();
                errMsg = errData.error || errMsg;
            } catch (_) { /* ignore JSON parse errors */ }
            showError(errMsg);
        }
    } catch (error) {
        showError('Failed to upload PDF: ' + error.message);
    } finally {
        hideLoading();
    }
});

// ---------------------------------------------------------------------------
// PDF loading (Task 2.2 – progress indicator)
// ---------------------------------------------------------------------------
async function loadPDFFromServer() {
    showLoading('Loading PDF...');
    try {
        const pdfUrl = `/pdf/${SESSION_ID}`;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);

        // Show byte-level progress while the PDF downloads
        loadingTask.onProgress = (progress) => {
            if (progress.total) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                showLoading(`Loading PDF… ${pct}%`);
            }
        };

        pdfDoc = await loadingTask.promise;
        pageInfo.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
        await renderPage(pageNum);
        updateControls();

        // Show laser-pointer toggle for the presenter
        if (isAdmin) laserToggle.classList.remove('hidden');
    } catch (error) {
        showError('Failed to load PDF: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Load PDF immediately for viewers who joined an active session
if (!isAdmin) {
    loadPDFFromServer();
}

// ---------------------------------------------------------------------------
// Page rendering with cache (Task 2.2)
// ---------------------------------------------------------------------------
async function renderPage(num) {
    if (!pdfDoc) return;

    // Serve from cache when available
    if (pageCache.has(num)) {
        const cached = pageCache.get(num);
        canvas.height = cached.height;
        canvas.width  = cached.width;
        canvas.style.height = cached.cssHeight;
        canvas.style.width  = cached.cssWidth;
        ctx.drawImage(cached.offscreen, 0, 0);
        syncPointerOverlay();
        pageInfo.textContent = `Page ${num} of ${pdfDoc.numPages}`;
        updateControls();
        return;
    }

    showLoading('Loading page…');
    try {
        const page        = await pdfDoc.getPage(num);
        const pixelRatio  = window.devicePixelRatio || 1;
        const viewport    = page.getViewport({ scale: zoomLevel * pixelRatio });

        canvas.height      = viewport.height;
        canvas.width       = viewport.width;
        const cssH = `${Math.floor(viewport.height / pixelRatio)}px`;
        const cssW = `${Math.floor(viewport.width  / pixelRatio)}px`;
        canvas.style.height = cssH;
        canvas.style.width  = cssW;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Cache the rendered bitmap in an off-screen canvas
        const offscreen = document.createElement('canvas');
        offscreen.height = canvas.height;
        offscreen.width  = canvas.width;
        offscreen.getContext('2d').drawImage(canvas, 0, 0);
        pageCache.set(num, {
            height: canvas.height, width: canvas.width,
            cssHeight: cssH, cssWidth: cssW,
            offscreen,
        });

        syncPointerOverlay();
        pageInfo.textContent = `Page ${num} of ${pdfDoc.numPages}`;
        updateControls();

        // Pre-render adjacent page in the background
        const next = num + 1;
        if (next <= pdfDoc.numPages && !pageCache.has(next)) {
            pdfDoc.getPage(next).then((p) => {
                const pr  = window.devicePixelRatio || 1;
                const vp  = p.getViewport({ scale: zoomLevel * pr });
                const oc  = document.createElement('canvas');
                oc.height = vp.height; oc.width = vp.width;
                p.render({ canvasContext: oc.getContext('2d'), viewport: vp })
                 .promise.then(() => {
                    if (!pageCache.has(next)) {
                        pageCache.set(next, {
                            height: vp.height, width: vp.width,
                            cssHeight: `${Math.floor(vp.height / pr)}px`,
                            cssWidth:  `${Math.floor(vp.width  / pr)}px`,
                            offscreen: oc,
                        });
                    }
                 });
            });
        }
    } catch (error) {
        showError('Failed to render page: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Keep the pointer overlay canvas in sync with the PDF canvas dimensions
function syncPointerOverlay() {
    pointerOverlay.height      = canvas.height;
    pointerOverlay.width       = canvas.width;
    pointerOverlay.style.height = canvas.style.height;
    pointerOverlay.style.width  = canvas.style.width;
}

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------
prevButton.addEventListener('click', () => {
    if (isAdmin && pdfDoc && pageNum > 1) goToPage(pageNum - 1);
});

nextButton.addEventListener('click', () => {
    if (isAdmin && pdfDoc && pageNum < pdfDoc.numPages) goToPage(pageNum + 1);
});

function goToPage(num) {
    pageNum = num;
    socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
}

// ---------------------------------------------------------------------------
// Keyboard navigation (Task 3.1)
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
    if (!isAdmin || !pdfDoc) return;
    // Ignore when focus is on an input element
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight' && pageNum < pdfDoc.numPages) goToPage(pageNum + 1);
    if (e.key === 'ArrowLeft'  && pageNum > 1)              goToPage(pageNum - 1);
});

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------
function changeZoom(delta) {
    zoomLevel = Math.max(0.5, Math.min(3.0, zoomLevel + delta));
    zoomLevelElem.textContent = `${Math.round(zoomLevel * 100)}%`;
    // Invalidate cache because dimensions change with zoom
    pageCache.clear();
    if (pdfDoc) renderPage(pageNum);
}

// ---------------------------------------------------------------------------
// Socket.IO event handlers
// ---------------------------------------------------------------------------
socket.on('session_state', async (data) => {
    pageNum = data.current_page;
    isAdmin = data.is_admin;
    updateUserCount(data.user_count);
    updateRoleIndicator();
    updateControls();

    // Restore chat history for newly-joined users
    if (Array.isArray(data.chat_history)) {
        data.chat_history.forEach(appendChatMessage);
    }

    if (!pdfDoc) await loadPDFFromServer();
    else await renderPage(pageNum);

    if (isAdmin) laserToggle.classList.remove('hidden');
});

socket.on('page_changed', async (data) => {
    pageNum = data.page;
    if (pdfDoc) await renderPage(pageNum);
    updateControls();
});

socket.on('user_joined', (data) => updateUserCount(data.user_count));

socket.on('user_left', (data) => {
    updateUserCount(data.user_count);
    if (data.new_admin === socket.id) {
        isAdmin = true;
        updateRoleIndicator();
        updateControls();
        laserToggle.classList.remove('hidden');
    }
});

// ---------------------------------------------------------------------------
// Laser pointer (Task 3.2)
// ---------------------------------------------------------------------------
let _laserX = null, _laserY = null;

function toggleLaserPointer() {
    laserEnabled = !laserEnabled;
    laserToggle.textContent = laserEnabled ? '🔴 Laser ON' : '🔴 Laser';
    laserToggle.classList.toggle('active', laserEnabled);
    if (!laserEnabled) pointerCtx.clearRect(0, 0, pointerOverlay.width, pointerOverlay.height);
}

// Presenter sends pointer coords on mousemove over the canvas
canvas.addEventListener('mousemove', (e) => {
    if (!isAdmin || !laserEnabled) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top)  * scaleY;
    socket.emit('pointer_move', { session_id: SESSION_ID, x, y, page: pageNum });
    drawPointerDot(x, y);
});

// Viewers receive pointer updates
socket.on('pointer_update', (data) => {
    if (data.page !== pageNum) return;
    drawPointerDot(data.x, data.y);
});

function drawPointerDot(x, y) {
    pointerCtx.clearRect(0, 0, pointerOverlay.width, pointerOverlay.height);
    pointerCtx.beginPath();
    pointerCtx.arc(x, y, 12, 0, 2 * Math.PI);
    pointerCtx.fillStyle = 'rgba(255, 0, 0, 0.55)';
    pointerCtx.fill();

    // Auto-hide after 2 seconds of inactivity
    clearTimeout(pointerHideTimer);
    pointerHideTimer = setTimeout(() => {
        pointerCtx.clearRect(0, 0, pointerOverlay.width, pointerOverlay.height);
    }, 2000);
}

// ---------------------------------------------------------------------------
// Chat (Task 3.3)
// ---------------------------------------------------------------------------
function toggleChat() {
    chatSidebar.classList.toggle('hidden');
    if (!chatSidebar.classList.contains('hidden')) chatInput.focus();
}

function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit('send_chat', {
        session_id: SESSION_ID,
        user: CHAT_USER,
        message: msg,
    });
    chatInput.value = '';
}

socket.on('receive_chat', appendChatMessage);

function appendChatMessage(data) {
    const item = document.createElement('div');
    item.className = 'chat-message';
    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.innerHTML =
        `<span class="chat-user">${escapeHtml(data.user)}</span>` +
        `<span class="chat-time">${time}</span>` +
        `<div class="chat-text">${escapeHtml(data.message)}</div>`;
    chatMessages.appendChild(item);
    // Keep at most 50 rendered messages
    while (chatMessages.children.length > 50) chatMessages.removeChild(chatMessages.firstChild);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function updateControls() {
    prevButton.disabled = !isAdmin || !pdfDoc || pageNum <= 1;
    nextButton.disabled = !isAdmin || !pdfDoc || pageNum >= (pdfDoc ? pdfDoc.numPages : 1);
    fileInput.disabled  = !isAdmin;
}

function updateUserCount(count) {
    userCount.textContent = `Users: ${count}`;
}

function updateRoleIndicator() {
    roleIndicator.textContent = `Role: ${isAdmin ? 'Presenter' : 'Viewer'}`;
}

function showShareUrl() {
    shareUrlSection.classList.remove('hidden');
    shareUrlInput.value = shareUrl;
}

function copyShareUrl() {
    shareUrlInput.select();
    document.execCommand('copy');
    alert('Share URL copied to clipboard!');
}

function showLoading(message) {
    loadingIndicator.textContent = message;
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => errorMessage.classList.add('hidden'), 5000);
}

