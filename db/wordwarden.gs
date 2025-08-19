const RULES_URL = 'https://raw.githubusercontent.com/OWNER/REPO/BRANCH/path/rules.json';
const DEFAULT_RULES = [{ pattern: "\\butilize\\b", replacement: "use", flags: "gi" }];

function loadRulesFromGitHub() {
  const cache = CacheService.getDocumentCache();
  const props = PropertiesService.getDocumentProperties();
  const cached = cache.get('rules_json');
  const etag  = props.getProperty('rules_etag');

  const res = UrlFetchApp.fetch(RULES_URL, {
    muteHttpExceptions: true,
    headers: etag ? { 'If-None-Match': etag } : {}
  });
  const code = res.getResponseCode();

  if (code === 304 && cached) return JSON.parse(cached); // not modified

  if (code === 200) {
    const text = res.getContentText();
    cache.put('rules_json', text, 3600); // 1h
    const newEtag = res.getHeaders()['ETag'] || res.getHeaders()['Etag'];
    if (newEtag) props.setProperty('rules_etag', newEtag);
    return JSON.parse(text);
  }

  // Fallbacks
  if (cached) return JSON.parse(cached);
  return DEFAULT_RULES;
}

function autoFixAll() {
  const text = DocumentApp.getActiveDocument().getBody().editAsText();
  loadRulesFromGitHub().forEach(r => {
    const re = new RegExp(r.pattern, r.flags || 'gi');
    text.replaceText(re, r.replacement);
  });
}
