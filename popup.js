import { blockWebsite, listWebsites, unblockWebsite } from './website-blocking.mjs';

const form = document.querySelector('#block-form');
const input = document.querySelector('#website');
const addButton = document.querySelector('#add-button');
const list = document.querySelector('#blocked-websites');
const emptyState = document.querySelector('#empty-state');
const status = document.querySelector('#status');

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function setBusy(busy) {
  input.disabled = busy;
  addButton.disabled = busy;
  list.querySelectorAll('button').forEach(button => { button.disabled = busy; });
}

async function renderWebsites() {
  const websites = await listWebsites();
  list.replaceChildren();
  emptyState.hidden = websites.length !== 0;
  for (const { id, domain } of websites) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = domain;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Unblock ${domain}`);
    removeButton.addEventListener('click', async () => {
      setBusy(true);
      try {
        await unblockWebsite(id);
        await renderWebsites();
        setStatus(`${domain} is now allowed.`);
      } catch {
        setStatus('Could not remove this website. Please reopen the popup and try again.', true);
      } finally {
        setBusy(false);
        input.focus();
      }
    });
    item.append(label, removeButton);
    list.append(item);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  setBusy(true);
  try {
    const domain = await blockWebsite(input.value);
    input.value = '';
    await renderWebsites();
    setStatus(`${domain} is blocked, including on subdomains.`);
  } catch (error) {
    setStatus(error.message || 'Could not save this website. Please try again.', true);
  } finally {
    setBusy(false);
    input.focus();
  }
});

try {
  await renderWebsites();
  setStatus('');
  setBusy(false);
} catch {
  setStatus('Could not load your blocklist. Reopen the popup to try again.', true);
}
