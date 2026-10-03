// JobAgent AI — Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  // Context menu item for quick clipping
  chrome.contextMenus.create({
    id: 'clip-to-jobagent',
    title: 'Clip Selection to JobAgent AI',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'clip-to-jobagent' && info.selectionText) {
    try {
      await fetch('http://localhost:4000/api/v1/opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: info.selectionText,
          url: tab?.url,
          type: 'JOB',
        }),
      });
    } catch {
      // Background network error
    }
  }
});
