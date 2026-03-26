// static/script.js
let socket = io();
let pdfDoc = null;
let pageNum = 1;
let zoomLevel = 1.5;
let isAdmin = IS_ADMIN;
let shareUrl = null;

// Zoom constraints
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// Elements
const canvas = document.getElementById('pdf-viewer');
const ctx = canvas.getContext('2d');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const pageInput = document.getElementById('page-input');
const jumpButton = document.getElementById('jump-button');
const fileInput = document.getElementById('pdf-upload');
const userCount = document.getElementById('user-count');
const connectionStatus = document.getElementById('connection-status');
const roleIndicator = document.getElementById('role-indicator');
const shareUrlSection = document.getElementById('share-url-section');
const shareUrlInput = document.getElementById('share-url');
const zoomLevelElem = document.getElementById('zoom-level');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingOverlayText = document.getElementById('loading-overlay-text');
const emptyState = document.getElementById('empty-state');
const emptyHint = document.getElementById('empty-hint');
const dropZone = document.getElementById('drop-zone');
const shortcutsHint = document.getElementById('shortcuts-hint');

// ── Toast notification system ──────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const iconMap = {
        success: 'fa-circle-check',
        error:   'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info',
    };
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info}"></i> ${message}`;
    container.appendChild(toast);

    const remove = () => {
        toast.classList.add('toast-hide');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
    const timer = setTimeout(remove, duration);
    toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ── Loading overlay ────────────────────────────────────────────────────────
function showLoading(message = 'Loading…') {
    loadingOverlayText.textContent = message;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// ── Socket.IO ──────────────────────────────────────────────────────────────
socket.on('connect', () => {
    connectionStatus.innerHTML = `<i class="fa-solid fa-circle status-dot"></i> Connected`;
    connectionStatus.classList.add('connected');
    connectionStatus.classList.remove('disconnected');
    socket.emit('join_session', { session_id: SESSION_ID, is_admin: isAdmin });
});

socket.on('disconnect', () => {
    connectionStatus.innerHTML = `<i class="fa-solid fa-circle status-dot"></i> Disconnected`;
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    showToast('Connection lost. Trying to reconnect…', 'warning');
});

// ── Drag-and-drop file upload ──────────────────────────────────────────────
function setupDropZone() {
    if (!isAdmin) return;

    dropZone.classList.remove('hidden');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            handlePDFFile(file);
        } else {
            showToast('Please drop a valid PDF file.', 'error');
        }
    });

    dropZone.addEventListener('click', () => fileInput.click());
}

// ── File input handler ─────────────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        await handlePDFFile(file);
    }
});

async function handlePDFFile(file) {
    showLoading('Uploading PDF…');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('session_id', SESSION_ID);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });

        if (response.ok) {
            const data = await response.json();
            shareUrl = data.session_url;
            showShareUrl();
            dropZone.classList.add('hidden');
            await loadPDFFromServer();
            hideLoading();
            showToast('PDF uploaded successfully!', 'success');
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        showToast('Failed to upload PDF: ' + error.message, 'error');
        hideLoading();
    }
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (!pdfDoc) return;

    if (e.key === 'ArrowLeft' && isAdmin && pageNum > 1) {
        pageNum--;
        socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
    } else if (e.key === 'ArrowRight' && isAdmin && pageNum < pdfDoc.numPages) {
        pageNum++;
        socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
    } else if (e.code === 'Space' && isAdmin && pageNum < pdfDoc.numPages) {
        e.preventDefault();
        pageNum++;
        socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
    }
});

// ── Load PDF from server ───────────────────────────────────────────────────
async function loadPDFFromServer() {
    showLoading('Loading PDF…');
    try {
        const pdfUrl = `/pdf/${SESSION_ID}`;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;
        pageInfo.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
        pageInput.max = pdfDoc.numPages;

        // Show canvas, hide empty state
        emptyState.classList.add('hidden');
        canvas.classList.remove('hidden');

        await renderPage(pageNum);
        updateControls();
        updateZoomDisplay();
        hideLoading();
    } catch (error) {
        showToast('Failed to load PDF: ' + error.message, 'error');
        hideLoading();
    }
}

// Initialize viewer for non-admin users
updateZoomDisplay();
if (!isAdmin) {
    loadPDFFromServer();
    emptyHint.textContent = 'Waiting for the presenter to load a PDF…';
} else {
    setupDropZone();
    shortcutsHint.classList.remove('hidden');
}

// ── Render page ────────────────────────────────────────────────────────────
async function renderPage(num) {
    showLoading('Rendering page…');
    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: zoomLevel });

        canvas.height = viewport.height;
        canvas.width  = viewport.width;

        await page.render({ canvasContext: ctx, viewport }).promise;

        pageInfo.textContent = `Page ${num} of ${pdfDoc.numPages}`;
        hideLoading();
    } catch (error) {
        showToast('Failed to render page: ' + error.message, 'error');
        hideLoading();
    }
}

// ── Navigation ─────────────────────────────────────────────────────────────
prevButton.addEventListener('click', () => {
    if (isAdmin && pageNum > 1) {
        pageNum--;
        socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
    }
});

nextButton.addEventListener('click', () => {
    if (isAdmin && pdfDoc && pageNum < pdfDoc.numPages) {
        pageNum++;
        socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
    }
});

pageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') jumpToPage();
});

// ── Socket events ──────────────────────────────────────────────────────────
socket.on('session_state', async (data) => {
    pageNum  = data.current_page;
    isAdmin  = data.is_admin;
    pageInput.value = pageNum;
    updateUserCount(data.user_count);
    updateRoleIndicator();
    updateControls();

    if (!pdfDoc) {
        await loadPDFFromServer();
    }
});

socket.on('page_changed', async (data) => {
    pageNum = data.page;
    pageInput.value = pageNum;
    if (pdfDoc) {
        await renderPage(pageNum);
    }
});

socket.on('user_joined', (data) => {
    updateUserCount(data.user_count);
});

socket.on('user_left', (data) => {
    updateUserCount(data.user_count);
    if (data.new_admin === socket.id) {
        isAdmin = true;
        updateRoleIndicator();
        updateControls();
        showToast('You are now the presenter!', 'info');
        setupDropZone();
    }
});

// ── Utilities ──────────────────────────────────────────────────────────────
function updateControls() {
    prevButton.disabled  = !isAdmin || pageNum <= 1;
    nextButton.disabled  = !isAdmin || !pdfDoc || pageNum >= pdfDoc.numPages;
    fileInput.disabled   = !isAdmin;
    pageInput.disabled   = !isAdmin;
    jumpButton.disabled  = !isAdmin;
}

function changeZoom(delta) {
    if (!pdfDoc) return;
    zoomLevel += delta;
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
    updateZoomDisplay();
    renderPage(pageNum);
}

function updateZoomDisplay() {
    zoomLevelElem.textContent = `${Math.round(zoomLevel * 100)}%`;
}

function jumpToPage() {
    if (!isAdmin || !pdfDoc) return;
    const targetPage = parseInt(pageInput.value, 10);
    if (isNaN(targetPage) || targetPage < 1 || targetPage > pdfDoc.numPages) {
        showToast(`Please enter a valid page number (1–${pdfDoc.numPages}).`, 'warning');
        return;
    }
    if (targetPage === pageNum) return;
    pageNum = targetPage;
    socket.emit('change_page', { session_id: SESSION_ID, page: pageNum });
}

function updateUserCount(count) {
    userCount.innerHTML = `<i class="fa-solid fa-users"></i> <span>${count} ${count === 1 ? 'user' : 'users'}</span>`;
}

function updateRoleIndicator() {
    const label = isAdmin ? 'Presenter' : 'Viewer';
    const icon  = isAdmin ? 'fa-chalkboard-user' : 'fa-eye';
    roleIndicator.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${label}</span>`;
}

function showShareUrl() {
    shareUrlSection.classList.remove('hidden');
    shareUrlInput.value = shareUrl;
}

function copyShareUrl() {
    shareUrlInput.select();
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Share link copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const success = document.execCommand('copy');
        if (success) {
            showToast('Share link copied to clipboard!', 'success');
        } else {
            showToast('Could not copy link. Please copy it manually.', 'warning');
        }
    });
}
