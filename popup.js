// ---------- Injected into the page: reads the chat from the DOM ----------
function extractChat() {
  const host = location.hostname;

  function md(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'button', 'svg', 'noscript'].includes(tag)) return '';
    const kids = () => Array.from(node.childNodes).map(md).join('');
    switch (tag) {
      case 'br': return '\n';
      case 'pre': {
        const code = node.querySelector('code');
        const lang = ((code && code.className) || '').match(/language-([\w+#-]+)/);
        const body = (code ? code.textContent : node.textContent).replace(/\n+$/, '');
        return '\n```' + (lang ? lang[1] : '') + '\n' + body + '\n```\n';
      }
      case 'code': return '`' + node.textContent + '`';
      case 'strong': case 'b': return '**' + kids() + '**';
      case 'em': case 'i': return '*' + kids() + '*';
      case 'a': return '[' + kids() + '](' + node.href + ')';
      case 'li': return '- ' + kids().trim() + '\n';
      case 'ol': {
        let n = 0;
        return '\n' + Array.from(node.children).map(c =>
          c.tagName === 'LI' ? (++n) + '. ' + md(c).replace(/^- /, '').trim() + '\n' : md(c)).join('') + '\n';
      }
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        return '\n' + '#'.repeat(+tag[1]) + ' ' + kids().trim() + '\n';
      case 'tr': return '| ' + Array.from(node.children).map(c => md(c).trim().replace(/\n/g, ' ')).join(' | ') + ' |\n';
      case 'p': case 'div': case 'ul': case 'blockquote': case 'table': case 'section':
        return '\n' + kids() + '\n';
      default: return kids();
    }
  }
  const clean = t => t.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const outermost = els => els.filter(e => !els.some(o => o !== e && o.contains(e)));

  let site = host.replace(/^www\./, '');
  let msgs = [];

  if (/chatgpt\.com|chat\.openai\.com/.test(host)) {
    site = 'ChatGPT';
    document.querySelectorAll('[data-message-author-role]').forEach(el => {
      const r = el.getAttribute('data-message-author-role');
      if (r === 'user' || r === 'assistant') msgs.push({ role: r, text: clean(md(el)) });
    });
  } else if (/claude\.ai/.test(host)) {
    site = 'Claude';
    const els = outermost(Array.from(document.querySelectorAll('[data-testid="user-message"], .font-claude-response')));
    els.forEach(el => msgs.push({
      role: el.matches('[data-testid="user-message"]') ? 'user' : 'assistant',
      text: clean(md(el))
    }));
  } else if (/gemini\.google\.com/.test(host)) {
    site = 'Gemini';
    document.querySelectorAll('user-query, model-response').forEach(el => msgs.push({
      role: el.tagName.toLowerCase() === 'user-query' ? 'user' : 'assistant',
      text: clean(md(el))
    }));
  }

  msgs = msgs.filter(m => m.text);

  // Selection wins, or fallback for sites without an adapter
  const sel = window.getSelection && window.getSelection().toString().trim();
  if (sel) {
    return { site, title: document.title, url: location.href, partial: true, messages: [{ role: 'selection', text: sel }] };
  }
  if (!msgs.length) {
    const main = document.querySelector('main') || document.body;
    msgs = [{ role: 'page', text: clean(md(main)) }];
    site += ' (generic capture)';
  }
  return { site, title: document.title, url: location.href, messages: msgs };
}

// ---------- Popup logic ----------
const $ = id => document.getElementById(id);
const roleLabel = { user: 'User', assistant: 'AI', selection: 'Selected text', page: 'Page content' };

const HANDOFF =
`# Context hand-off

Below is a transcript of earlier conversation(s) I had with other AI assistant(s). Treat it as background context for our chat:
- "User" is me; "AI" is the previous assistant.
- Do not answer the transcript itself or redo its work unless I ask.
- First reply with a brief summary of where things stand and the open questions, then wait for my next instruction.

---

`;

async function getChats() {
  const { chats = [] } = await chrome.storage.local.get('chats');
  return chats;
}
const setChats = chats => chrome.storage.local.set({ chats });

function buildMarkdown(chats) {
  const parts = chats.map((c, i) => {
    const head = `## Conversation ${i + 1}: ${c.title || 'Untitled'}\n` +
      `*Source: ${c.site} — ${c.url}*  \n*Captured: ${new Date(c.capturedAt).toLocaleString()}*` +
      (c.partial ? '  \n*(partial: selected text only)*' : '') + '\n\n';
    const body = c.messages.map(m => `### ${roleLabel[m.role] || m.role}\n\n${m.text}`).join('\n\n');
    return head + body;
  });
  return (chats.length && $('handoff').checked ? HANDOFF : '') + parts.join('\n\n---\n\n') + (chats.length ? '\n' : '');
}

async function render() {
  const chats = await getChats();
  const list = $('list');
  list.innerHTML = '';
  chats.forEach((c, i) => {
    const li = document.createElement('li');
    const s = document.createElement('span');
    s.textContent = `${i + 1}. ${c.site}: ${c.title || c.url} (${c.messages.length} msg)`;
    const b = document.createElement('button');
    b.textContent = '×';
    b.title = 'Remove';
    b.onclick = async () => { chats.splice(i, 1); await setChats(chats); render(); };
    li.append(s, b);
    list.append(li);
  });
  $('preview').value = buildMarkdown(chats);
}

function status(t) { $('status').textContent = t; }

$('capture').onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:/.test(tab.url || '')) return status('Open a chat page (http/https) first.');
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractChat });
    const chat = res.result;
    chat.capturedAt = Date.now();
    let chats = await getChats();
    if (!chat.partial) chats = chats.filter(c => c.url !== chat.url); // re-capture replaces older copy
    chats.push(chat);
    await setChats(chats);
    status(`Captured ${chat.messages.length} message(s) from ${chat.site}.`);
    render();
  } catch (e) {
    status('Could not read this tab: ' + e.message);
  }
};

$('copy').onclick = async () => {
  await navigator.clipboard.writeText($('preview').value);
  status('Copied. Paste it into the other AI.');
};

$('download').onclick = () => {
  const blob = new Blob([$('preview').value], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ai-chat-context-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('clear').onclick = async () => { await setChats([]); status('Cleared.'); render(); };
$('handoff').onchange = render;

render();