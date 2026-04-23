// ============================================
// MedAssist AI — Frontend Logic
// ============================================

// ========== DOM Elements ==========
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const uploadProg     = document.getElementById('upload-progress');
const progFilename   = document.getElementById('progress-filename');
const progStatus     = document.getElementById('progress-status');
const progFill       = document.getElementById('progress-fill');
const fileList       = document.getElementById('file-list');
const fileCount      = document.getElementById('file-count');
const emptyFiles     = document.getElementById('empty-files');
const chatMessages   = document.getElementById('chat-messages');
const questionInput  = document.getElementById('question-input');
const sendBtn        = document.getElementById('send-btn');
const clearBtn       = document.getElementById('clear-chat-btn');
const menuBtn        = document.getElementById('menu-btn');
const sidebar        = document.getElementById('sidebar');
const charCount      = document.getElementById('char-count');
const modeBadge      = document.getElementById('current-mode');
const statChunks     = document.getElementById('stat-chunks');
const statFiles      = document.getElementById('stat-files');
const toastContainer = document.getElementById('toast-container');

let isProcessing = false;
let uploadedCount = 0;

// Configure marked for safe rendering
marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false
});

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchFiles();
});

// ========== TOAST SYSTEM ==========
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${type === 'success' 
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' 
                : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
        </svg>
        ${message}
    `;
    toastContainer.appendChild(toast);
    
    // Auto-remove after animation
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3800);
}

// ========== SIDEBAR TOGGLE (Mobile) ==========
menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    toggleOverlay();
});

function toggleOverlay() {
    let overlay = document.querySelector('.sidebar-overlay');
    if (sidebar.classList.contains('open')) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay show';
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.remove();
            });
            document.body.appendChild(overlay);
        } else {
            overlay.classList.add('show');
        }
    } else if (overlay) {
        overlay.remove();
    }
}

// ========== FILE UPLOAD ==========
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
});

// Drag & Drop
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
    if (file) uploadFile(file);
});

async function uploadFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Only PDF files are supported');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        showToast('File size exceeds 50MB limit');
        return;
    }

    // Show progress
    uploadProg.style.display = 'block';
    progFilename.textContent = file.name;
    progStatus.textContent = 'Uploading...';
    progStatus.style.color = '';
    progFill.style.width = '0%';
    progFill.classList.remove('indeterminate');

    const formData = new FormData();
    formData.append('file', file);

    progFill.style.width = '30%';

    try {
        progFill.style.width = '50%';
        progStatus.textContent = 'Processing & embedding medical content...';
        progFill.classList.add('indeterminate');

        const res = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        progFill.classList.remove('indeterminate');

        if (res.ok) {
            progFill.style.width = '100%';
            progStatus.textContent = 'Done!';
            progStatus.style.color = 'var(--success)';
            showToast(data.message, 'success');
            addFileToList(data.filename);
            fetchStats();

            setTimeout(() => {
                uploadProg.style.display = 'none';
                progStatus.style.color = '';
            }, 2000);
        } else {
            progFill.style.width = '0%';
            progStatus.textContent = 'Failed';
            progStatus.style.color = 'var(--error)';
            showToast(data.error || 'Upload failed');
        }
    } catch (err) {
        progFill.classList.remove('indeterminate');
        progFill.style.width = '0%';
        progStatus.textContent = 'Error';
        progStatus.style.color = 'var(--error)';
        showToast('Could not connect to server');
    }

    fileInput.value = '';
}

function addFileToList(filename) {
    if (emptyFiles) emptyFiles.style.display = 'none';
    
    uploadedCount++;
    fileCount.textContent = uploadedCount;

    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
        <div class="file-dot"></div>
        <span class="file-name" title="${filename}">${filename}</span>
        <span class="file-badge">Ready</span>
    `;
    fileList.appendChild(item);
}

// ========== STATS ==========
async function fetchStats() {
    try {
        const res = await fetch('/stats');
        const data = await res.json();
        animateNumber(statChunks, data.chunks);
        animateNumber(statFiles, data.files);
    } catch (e) {
        // Silent fail
    }
}

async function fetchFiles() {
    try {
        const res = await fetch('/files');
        const data = await res.json();
        if (data.files && data.files.length > 0) {
            data.files.forEach(f => addFileToList(f.name));
        }
    } catch (e) {
        // Silent fail
    }
}

function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    
    const duration = 600;
    const start = performance.now();
    
    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.textContent = Math.round(current + (target - current) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    
    requestAnimationFrame(update);
}

// ========== CHAT ==========
sendBtn.addEventListener('click', sendMessage);

questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize & char count
questionInput.addEventListener('input', () => {
    questionInput.style.height = 'auto';
    questionInput.style.height = Math.min(questionInput.scrollHeight, 140) + 'px';
    
    const len = questionInput.value.length;
    charCount.textContent = `${len} / 4000`;
    sendBtn.disabled = len === 0;
});

// Quick action buttons
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        questionInput.value = btn.dataset.query;
        questionInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

// Clear chat
clearBtn.addEventListener('click', () => {
    chatMessages.innerHTML = '';
    
    // Re-add medical welcome screen
    chatMessages.innerHTML = `
        <div class="welcome-screen" id="welcome-screen">
            <div class="welcome-badge">
                <div class="welcome-icon-ring">
                    <div class="welcome-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                    </div>
                </div>
            </div>
            <h2 class="welcome-title">How can I help with your health question?</h2>
            <p class="welcome-desc">Upload medical literature (research papers, clinical guidelines, textbooks) for evidence-based answers, or ask any health question directly.</p>
            <div class="quick-actions">
                <button class="quick-btn" data-query="Summarize the uploaded medical document">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
                    </svg>
                    Medical Summary
                </button>
                <button class="quick-btn" data-query="I have the following symptoms and would like to understand what they might indicate">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    Check Symptoms
                </button>
                <button class="quick-btn" data-query="What are common drug interactions I should know about?">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    Drug Interactions
                </button>
            </div>
        </div>
    `;

    // Re-bind quick buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            questionInput.value = btn.dataset.query;
            questionInput.dispatchEvent(new Event('input'));
            sendMessage();
        });
    });

    // Update mode badge
    modeBadge.className = 'mode-badge';
    modeBadge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        Gemini
    `;
});

async function sendMessage() {
    const question = questionInput.value.trim();
    if (!question || isProcessing) return;

    isProcessing = true;
    sendBtn.disabled = true;

    // Clear welcome screen if present
    const welcome = chatMessages.querySelector('.welcome-screen');
    if (welcome) welcome.remove();

    // Add user message
    appendMessage('user', question);
    questionInput.value = '';
    questionInput.style.height = 'auto';
    charCount.textContent = '0 / 4000';

    // Show typing indicator
    const typingEl = showTyping();

    try {
        const res = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        const data = await res.json();
        removeTyping(typingEl);

        if (res.ok) {
            appendMessage('assistant', data.answer, {
                mode: data.mode,
                confidence: data.confidence,
                sources: data.sources,
                severity: data.severity
            });

            // Update mode badge
            if (data.mode === 'RAG') {
                modeBadge.className = 'mode-badge mode-rag';
                modeBadge.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Medical RAG
                `;
            } else {
                modeBadge.className = 'mode-badge';
                modeBadge.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    Gemini
                `;
            }
        } else {
            appendMessage('assistant', data.error || 'Something went wrong.');
        }
    } catch (err) {
        removeTyping(typingEl);
        appendMessage('assistant', 'Could not reach the server. Make sure it\'s running on port 5000.');
    }

    isProcessing = false;
    sendBtn.disabled = questionInput.value.length === 0;
    questionInput.focus();
}

function appendMessage(role, text, meta = null) {
    const msg = document.createElement('div');
    msg.className = `message ${role === 'user' ? 'user-msg' : 'ai-msg'}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'MD';

    const body = document.createElement('div');
    body.className = 'msg-body';

    const content = document.createElement('div');
    content.className = 'msg-content';
    
    if (role === 'assistant') {
        // Render markdown for AI responses
        try {
            content.innerHTML = marked.parse(text);
        } catch (e) {
            content.textContent = text;
        }
    } else {
        content.textContent = text;
    }
    
    body.appendChild(content);

    // Add metadata tags for assistant
    if (role === 'assistant' && meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'msg-meta';

        // Severity badge (first for visibility)
        if (meta.severity) {
            const sevTag = document.createElement('span');
            const sevIcons = {
                'mild': '🟢',
                'moderate': '🟡',
                'severe': '🔴'
            };
            sevTag.className = `tag tag-severity tag-severity-${meta.severity}`;
            sevTag.textContent = `${sevIcons[meta.severity] || '⚪'} ${meta.severity.toUpperCase()}`;
            metaDiv.appendChild(sevTag);
        }

        // Mode tag
        if (meta.mode) {
            const modeTag = document.createElement('span');
            modeTag.className = `tag ${meta.mode === 'RAG' ? 'tag-rag' : 'tag-gemini'}`;
            modeTag.textContent = meta.mode === 'RAG' ? '📚 Medical RAG' : '✨ Gemini';
            metaDiv.appendChild(modeTag);
        }

        // Confidence
        if (meta.confidence != null) {
            const confTag = document.createElement('span');
            confTag.className = 'tag tag-confidence';
            confTag.textContent = `⚡ ${(meta.confidence * 100).toFixed(0)}% confidence`;
            metaDiv.appendChild(confTag);
        }

        // Sources
        if (meta.sources && meta.sources.length) {
            meta.sources.forEach(src => {
                const srcTag = document.createElement('span');
                srcTag.className = 'tag tag-source';
                srcTag.textContent = `📄 ${src}`;
                srcTag.title = src;
                metaDiv.appendChild(srcTag);
            });
        }

        body.appendChild(metaDiv);
    }

    msg.appendChild(avatar);
    msg.appendChild(body);
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    const msg = document.createElement('div');
    msg.className = 'message ai-msg';
    msg.id = 'typing-msg';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = 'MD';

    const body = document.createElement('div');
    body.className = 'msg-body';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    body.appendChild(indicator);

    msg.appendChild(avatar);
    msg.appendChild(body);
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msg;
}

function removeTyping(el) {
    if (el && el.parentNode) el.remove();
}
