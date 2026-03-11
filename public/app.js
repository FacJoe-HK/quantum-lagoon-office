document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const fileList = document.getElementById('fileList');
    const refreshWorkspaceBtn = document.getElementById('refreshWorkspaceBtn');

    // Modal elements
    const fileModal = document.getElementById('fileModal');
    const closeModal = document.getElementById('closeModal');
    const modalFilename = document.getElementById('modalFilename');
    const modalFileContent = document.getElementById('modalFileContent');

    // Configure Marked.js
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        breaks: true,
        gfm: true
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim() === '') {
            sendBtn.disabled = true;
        } else {
            sendBtn.disabled = false;
        }
    });

    // Handle Enter to send (Shift+Enter for new line)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    refreshWorkspaceBtn.addEventListener('click', loadWorkspace);
    closeModal.addEventListener('click', () => {
        fileModal.classList.remove('active');
    });

    // Close modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === fileModal) {
            fileModal.classList.remove('active');
        }
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user message
        appendMessage('user', text);

        // Reset input
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.disabled = true;

        // Show loading
        loadingIndicator.classList.add('active');
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();

            if (response.ok) {
                appendMessage('assistant', data.response);
                // Refresh workspace in case the agent created a file
                loadWorkspace();
            } else {
                appendMessage('assistant', `❌ Error: ${data.error}`);
            }
        } catch (error) {
            appendMessage('assistant', `❌ Connection Error: ${error.message}`);
        } finally {
            loadingIndicator.classList.remove('active');
        }
    }

    function appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;

        let avatarIcon = role === 'user' ? 'U' : '👔';
        let authorName = role === 'user' ? 'You' : 'Consultant Agent';

        // Parse markdown and sanitize for assistant messages
        // For user messages, just use plain text safely
        let htmlContent = '';
        if (role === 'assistant') {
            const rawHtml = marked.parse(content);
            htmlContent = DOMPurify.sanitize(rawHtml);
        } else {
            htmlContent = `<p>${DOMPurify.sanitize(content)}</p>`;
        }

        msgDiv.innerHTML = `
            <div class="avatar">${avatarIcon}</div>
            <div class="message-content">
                <strong>${authorName}</strong>
                ${htmlContent}
            </div>
        `;

        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    async function loadWorkspace() {
        refreshWorkspaceBtn.style.transform = 'rotate(180deg)';
        setTimeout(() => refreshWorkspaceBtn.style.transform = '', 300);

        try {
            const response = await fetch('/api/workspace');
            const data = await response.json();

            fileList.innerHTML = '';

            if (data.files && data.files.length > 0) {
                data.files.forEach(file => {
                    const li = document.createElement('li');
                    li.className = 'file-item';

                    const iconClass = getIconForFile(file);

                    li.innerHTML = `
                        <button class="file-btn" data-filename="${file}">
                            <span class="${iconClass}">■</span> ${file}
                        </button>
                    `;
                    fileList.appendChild(li);
                });

                // Attach click listeners to new buttons
                document.querySelectorAll('.file-btn').forEach(btn => {
                    btn.addEventListener('click', () => openFile(btn.dataset.filename));
                });
            } else {
                fileList.innerHTML = '<li style="padding: 10px; color: var(--text-secondary); font-size: 13px;">Workspace is empty</li>';
            }
        } catch (error) {
            console.error('Failed to load workspace files', error);
        }
    }

    function getIconForFile(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) return 'icon-doc';
        if (['xlsx', 'xls', 'csv'].includes(ext)) return 'icon-sheet';
        if (['json', 'js', 'ts', 'py', 'sh'].includes(ext)) return 'icon-code';
        return 'icon-text';
    }

    async function openFile(filename) {
        try {
            const response = await fetch(`/api/workspace/${filename}`);
            const data = await response.json();

            if (response.ok) {
                modalFilename.textContent = filename;
                modalFileContent.textContent = data.content;
                fileModal.classList.add('active');
            } else {
                alert(`Error reading file: ${data.error}`);
            }
        } catch (error) {
            alert(`Network error reading file: ${error.message}`);
        }
    }

    // Initial load
    sendBtn.disabled = true;
    loadWorkspace();
});
