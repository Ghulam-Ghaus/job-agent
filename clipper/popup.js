document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url');
  const textInput = document.getElementById('text');
  const typeSelect = document.getElementById('type');
  const sendBtn = document.getElementById('sendBtn');
  const statusDiv = document.getElementById('status');

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    urlInput.value = tab.url || '';

    // Inject script to get highlighted text
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection()?.toString();
          if (selection && selection.trim().length > 0) {
            return selection.trim();
          }
          // If no selection, grab main body text
          return document.body.innerText.slice(0, 4000);
        },
      });

      if (results && results[0] && results[0].result) {
        textInput.value = results[0].result;
      }
    } catch {
      // Scripting not allowed on internal browser pages
    }
  }

  sendBtn.addEventListener('click', async () => {
    const rawText = textInput.value.trim();
    const sourceUrl = urlInput.value.trim();
    const type = typeSelect.value;

    if (!rawText) {
      showStatus('Please select or paste job text to import.', 'error');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Importing & Scoring...';

    try {
      const response = await fetch('http://localhost:4000/api/v1/opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include', // Uses active session cookie
        body: JSON.stringify({
          text: rawText,
          url: sourceUrl || undefined,
          type,
        }),
      });

      const json = await response.json();

      if (response.ok) {
        showStatus('Successfully sent to JobAgent AI!', 'success');
        setTimeout(() => window.close(), 1800);
      } else {
        const errorMsg = json?.error?.message || json?.message || 'Import failed. Are you logged in?';
        showStatus(errorMsg, 'error');
      }
    } catch {
      showStatus('Connection error. Ensure JobAgent backend is running at http://localhost:4000.', 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send to JobAgent AI';
    }
  });

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
  }
});
