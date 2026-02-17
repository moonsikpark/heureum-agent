/**
 * Heureum Browser Control - Background Service Worker
 *
 * Connects to the Electron client via WebSocket and executes browser commands.
 * User-initiated: click the toolbar icon to connect/disconnect.
 */

const WS_URL = 'ws://localhost:9222';

const BADGE = {
  on:         { text: 'ON',  color: '#22c55e' },
  off:        { text: '',    color: '#000000' },
  connecting: { text: '...', color: '#F59E0B' },
  error:      { text: '!',   color: '#B91C1C' },
};

/** @type {WebSocket|null} */
let ws = null;
/** @type {Promise<void>|null} */
let connectPromise = null;

// --- Badge ---

function setBadge(kind) {
  const cfg = BADGE[kind];
  void chrome.action.setBadgeText({ text: cfg.text });
  void chrome.action.setBadgeBackgroundColor({ color: cfg.color });
  void chrome.action.setBadgeTextColor({ color: '#FFFFFF' }).catch(() => {});
}

// --- WebSocket Connection ---

/**
 * Connect to the Electron WebSocket server.
 * Deduplicates concurrent calls via connectPromise.
 */
async function connectToRelay() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (connectPromise) return await connectPromise;

  connectPromise = doConnect();
  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }
}

async function doConnect() {
  // Clean up stale socket
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  setBadge('connecting');
  void chrome.action.setTitle({
    title: 'Heureum: connecting to Electron client...',
  });

  const socket = new WebSocket(WS_URL);

  // Wait for connection with 5s timeout
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error('WebSocket connect timeout'));
    }, 5000);

    socket.onopen = () => {
      clearTimeout(t);
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(t);
      reject(new Error('WebSocket connect failed'));
    };
    socket.onclose = (ev) => {
      clearTimeout(t);
      reject(new Error(`WebSocket closed (${ev.code})`));
    };
  });

  // Connection succeeded — set up handlers
  ws = socket;

  ws.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    // Handle ping/pong keepalive
    if (msg && msg.method === 'ping') {
      send({ method: 'pong' });
      return;
    }

    const { id, action, params } = msg;
    if (!id || !action) return;

    try {
      const result = await handleCommand(action, params || {});
      send({ id, success: true, result });
    } catch (err) {
      send({ id, success: false, error: err.message || String(err) });
    }
  };

  ws.onclose = () => {
    console.log('[Heureum] Disconnected from Electron client');
    ws = null;
    setBadge('error');
    void chrome.action.setTitle({
      title: 'Heureum: disconnected (click to reconnect)',
    });
  };

  ws.onerror = () => {
    // onclose will fire after this
  };

  console.log('[Heureum] Connected to Electron client');
  setBadge('on');
  void chrome.action.setTitle({
    title: 'Heureum: connected (click to disconnect)',
  });
}

function disconnect() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  setBadge('off');
  void chrome.action.setTitle({
    title: 'Heureum Browser Control (click to connect)',
  });
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// --- Toolbar Icon Click ---

chrome.action.onClicked.addListener(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    disconnect();
  } else {
    connectToRelay().catch((err) => {
      console.warn('[Heureum] Connection failed:', err.message);
      setBadge('error');
      void chrome.action.setTitle({
        title: 'Heureum: connection failed (click to retry)',
      });
    });
  }
});

// --- Command Handlers ---

async function handleCommand(action, params) {
  switch (action) {
    case 'navigate':
      return await handleNavigate(params);
    case 'new_tab':
      return await handleNewTab(params);
    case 'click':
      return await handleClick(params);
    case 'type':
      return await handleType(params);
    case 'get_content':
      return await handleGetContent(params);
    case 'get_tabs':
      return await handleGetTabs();
    case 'switch_tab':
      return await handleSwitchTab(params);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Get the currently active tab.
 */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab found');
  return tab;
}

/**
 * Wait for a tab to finish loading.
 */
function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab loading timed out'));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Extract page content from a tab by injecting the content script.
 */
async function extractContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });

  if (results && results[0] && results[0].result) {
    return results[0].result;
  }
  return 'Failed to extract page content';
}

// --- Action Handlers ---

async function handleNavigate({ url }) {
  if (!url) throw new Error('url parameter is required');

  const tab = await getActiveTab();
  await chrome.tabs.update(tab.id, { url });
  await waitForTabComplete(tab.id);

  // Small delay for dynamic content
  await new Promise((r) => setTimeout(r, 500));

  const content = await extractContent(tab.id);
  return content;
}

async function handleNewTab({ url }) {
  if (!url) throw new Error('url parameter is required');

  const tab = await chrome.tabs.create({ url, active: true });
  await waitForTabComplete(tab.id);
  await new Promise((r) => setTimeout(r, 500));

  const content = await extractContent(tab.id);
  return `Opened new tab (id: ${tab.id})\n\n${content}`;
}

async function handleClick({ selector }) {
  if (!selector) throw new Error('selector parameter is required');

  const tab = await getActiveTab();

  // Click the element with full mouse event simulation
  const clickResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { success: false, error: `Element not found: ${sel}` };

      // Scroll element into view
      el.scrollIntoView({ block: 'center', behavior: 'instant' });

      // Simulate full mouse interaction sequence
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

      el.dispatchEvent(new PointerEvent('pointerover', opts));
      el.dispatchEvent(new MouseEvent('mouseover', opts));
      el.dispatchEvent(new PointerEvent('pointerenter', opts));
      el.dispatchEvent(new MouseEvent('mouseenter', opts));
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, button: 0 }));
      el.dispatchEvent(new MouseEvent('mousedown', { ...opts, button: 0 }));
      el.focus?.();
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, button: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...opts, button: 0 }));
      el.dispatchEvent(new MouseEvent('click', { ...opts, button: 0 }));

      return { success: true };
    },
    args: [selector],
  });

  const clickResult = clickResults?.[0]?.result;
  if (!clickResult?.success) {
    throw new Error(clickResult?.error || 'Click failed');
  }

  // Wait for potential navigation or content change
  await new Promise((r) => setTimeout(r, 1000));

  // Check if navigation occurred
  try {
    await waitForTabComplete(tab.id, 3000);
  } catch {
    // No navigation, that's fine
  }

  const content = await extractContent(tab.id);
  return `Clicked: ${selector}\n\n${content}`;
}

async function handleType({ selector, text }) {
  if (!selector) throw new Error('selector parameter is required');
  if (text === undefined || text === null) throw new Error('text parameter is required');

  const tab = await getActiveTab();

  const typeResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel, value) => {
      const el = document.querySelector(sel);
      if (!el) return { success: false, error: `Element not found: ${sel}` };

      el.focus();

      // Clear existing value
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));

      // Set new value
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true };
    },
    args: [selector, text],
  });

  const result = typeResults?.[0]?.result;
  if (!result?.success) {
    throw new Error(result?.error || 'Type failed');
  }

  return `Typed "${text}" into ${selector}`;
}

async function handleGetContent({ tabId }) {
  const tab = tabId ? { id: tabId } : await getActiveTab();
  const content = await extractContent(tab.id);
  return content;
}

async function handleGetTabs() {
  const tabs = await chrome.tabs.query({});
  const tabList = tabs.map((t) => `${t.id}: "${t.title}" - ${t.url}`);
  return `Open tabs:\n${tabList.join('\n')}`;
}

async function handleSwitchTab({ tabId }) {
  if (!tabId) throw new Error('tabId parameter is required');

  await chrome.tabs.update(tabId, { active: true });
  const tab = await chrome.tabs.get(tabId);

  // Focus the window containing the tab
  await chrome.windows.update(tab.windowId, { focused: true });

  const content = await extractContent(tabId);
  return `Switched to tab ${tabId}: "${tab.title}"\n\n${content}`;
}
