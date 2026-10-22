// URL metadata can be omitted even when a valid tab ID is available. Let the
// scripting permission check decide whether the page can actually be accessed.
export async function activePage(query = options => chrome.tabs.query(options)) {
  const [tab] = await query({active:true,lastFocusedWindow:true});
  if (!Number.isInteger(tab?.id) || tab.id < 0) throw new Error('Select the browser tab containing FOLIO, then open ScriptShifter from its toolbar icon.');
  if (tab.url && !/^https?:/.test(tab.url)) throw new Error('Select the FOLIO web page, then click the ScriptShifter toolbar icon.');
  return tab;
}
