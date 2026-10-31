// Dynamic rules are the persistent blocklist, so settings and enforcement cannot
// drift apart. Only top-level navigation is blocked, not embedded site resources.
export function normalizeWebsite(value) {
  const input = value.trim();
  if (!input || /\s/.test(input) || (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input))) {
    throw new Error('Enter a website domain or an HTTP(S) URL.');
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error('Enter a valid website, such as example.com.');
  }

  // Treat the common www prefix as the same site as the bare domain.
  const domain = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  const validLabels = domain.split('.').every(label =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
  );
  if (url.username || url.password || !validLabels || domain.length > 253) {
    throw new Error('Enter a valid domain without a login or wildcards.');
  }
  const path = url.pathname === '/' ? '' : url.pathname;
  if (/[|^]/.test(path)) {
    throw new Error('Paths cannot contain | or ^ characters.');
  }
  return domain + path;
}

export async function listWebsites(api = chrome.declarativeNetRequest) {
  const rules = await api.getDynamicRules();
  return rules.map(rule => ({
    id: rule.id,
    domain: rule.condition.urlFilter
      ? rule.condition.urlFilter.slice(2)
      : rule.condition.requestDomains[0]
  }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export async function blockWebsite(value, api = chrome.declarativeNetRequest) {
  const domain = normalizeWebsite(value);
  const hostname = domain.split('/')[0];
  const websites = await listWebsites(api);
  if (websites.some(website => website.domain === domain)) {
    throw new Error(`${domain} is already blocked.`);
  }
  const usedIds = new Set(websites.map(website => website.id));
  let id = 1;
  while (usedIds.has(id)) id++;
  await api.updateDynamicRules({
    addRules: [{
      id,
      priority: 1,
      action: { type: 'block' },
      condition: {
        requestDomains: [hostname],
        resourceTypes: ['main_frame'],
        ...(domain.includes('/') ? { urlFilter: `||${domain}`, isUrlFilterCaseSensitive: true } : {})
      }
    }],
    removeRuleIds: []
  });
  return domain;
}

export async function unblockWebsite(id, api = chrome.declarativeNetRequest) {
  await api.updateDynamicRules({ removeRuleIds: [id] });
}
