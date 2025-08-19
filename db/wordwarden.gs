const RULES_URL = 'https://raw.githubusercontent.com/conchoecia/wordwarden/refs/heads/main/db/rules.json';
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


/**
 * Scan the active Google Doc and add comments for every rule match.
 *
 * Each rule from loadRulesFromGitHub() should look like:
 *   {
 *     pattern: "\\butilize\\b",
 *     replacement: "use",
 *     flags: "gi",
 *     note: "Prefer plain English"
 *   }
 *
 * For each match, this function:
 *   - Locates the offending word/phrase
 *   - Creates a suggested alternative
 *   - Adds a comment to the document with an explanation
 *
 * @returns {void}
 */
function commentOnMatches() {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const rules = loadRulesFromGitHub();

  let commentCount = 0;

  rules.forEach(r => {
    const re = new RegExp(r.pattern, r.flags || 'gi');
    let match = body.findText(re);

    while (match) {
      const el = match.getElement().asText();
      const start = match.getStartOffset();
      const end = match.getEndOffsetInclusive();

      // Build a Range covering just the matched text
      const range = doc.newRange().addElement(el, start, end).build();

      // Create a comment explaining the issue
      const replacement = r.replacement || "";
      const note = r.note ? ` (${r.note})` : "";
      doc.setSelection(range);
      doc.addComment(
        `Consider replacing "${el.getText().substring(start, end + 1)}" with "${replacement}".${note}`
      );

      commentCount++;
      // Find next match
      match = body.findText(re, match);
    }
  });

  DocumentApp.getUi().alert(`Added ${commentCount} comment(s).`);
}