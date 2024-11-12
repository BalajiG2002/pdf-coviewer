// Static/script.js
let socket = io();
let pdfDoc = null;
let pageNum = 1;
let zoomLevel = 1.5;
let isAdmin = IS_ADMIN;
let shareUrl = null;

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// Elements
const canvas = document.getElementById('pdf-viewer');
const ctx = canvas.getContext('2d');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const fileInput = document.getElementById('pdf-upload');
const userCount = document.getElementById('user-count');
const connectionStatus = document.getElementById('connection-status');
const roleIndicator = document.getElementById('role-indicator');
const shareUrlSection = document.getElementById('share-url-section');
const shareUrlInput = document.getElementById('share-url');
const zoomLevelElem = document.getElementById('zoom-level');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');

// Connect to WebSocket
socket.on('connect', () => {
    connectionStatus.textContent = '🟢 Connected';
    socket.emit('join_session', {
        session_id: SESSION_ID,
        is_admin: isAdmin
    });
});

socket.on('disconnect', () => {
    connectionStatus.textContent = '🔴 Disconnected';
});

// Handle file upload
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        showLoading('Uploading PDF...');
        
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('session_id', SESSION_ID);
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                shareUrl = data.session_url;
                showShareUrl();
                
                // Load the PDF from server URL instead of local file
                await loadPDFFromServer();
                hideLoading();
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            showError('Failed to upload PDF: ' + error.message);
            hideLoading();
        }
    }
});

// Load PDF from server
async function loadPDFFromServer() {
    showLoading('Loading PDF...');
    try {
        const pdfUrl = `/pdf/${SESSION_ID}`;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;
        pageInfo.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
        await renderPage(pageNum);
        updateControls();
        hideLoading();
    } catch (error) {
        showError('Failed to load PDF: ' + error.message);
        hideLoading();
    }
}

// Initialize viewer for non-admin users
if (!isAdmin) {
    loadPDFFromServer();
}

async function renderPage(num) {
    showLoading('Loading page...');
    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({scale: zoomLevel});
        
        // Adjust canvas size to match viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        pageInfo.textContent = `Page ${num} of ${pdfDoc.numPages}`;
        hideLoading();
    } catch (error) {
        showError('Failed to render page: ' + error.message);
        hideLoading();
    }
}

// Navigation handlers
prevButton.addEventListener('click', () => {
    if (isAdmin && pageNum > 1) {
        pageNum--;
        socket.emit('change_page', {
            session_id: SESSION_ID,
            page: pageNum
        });
    }
});

nextButton.addEventListener('click', () => {
    if (isAdmin && pdfDoc && pageNum < pdfDoc.numPages) {
        pageNum++;
        socket.emit('change_page', {
            session_id: SESSION_ID,
            page: pageNum
        });
    }
});

// Socket event handlers
socket.on('session_state', async (data) => {
    pageNum = data.current_page;
    isAdmin = data.is_admin;
    updateUserCount(data.user_count);
    updateRoleIndicator();
    updateControls();
    
    // Load PDF if available and not already loaded
    if (!pdfDoc) {
        await loadPDFFromServer();
    }
});

socket.on('page_changed', async (data) => {
    pageNum = data.page;
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
    }
});

// Rest of the utility functions remain the same...
// Utility functions
function updateControls() {
    prevButton.disabled = !isAdmin || pageNum <= 1;
    nextButton.disabled = !isAdmin || !pdfDoc || pageNum >= pdfDoc.numPages;
    fileInput.disabled = !isAdmin;
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
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}
