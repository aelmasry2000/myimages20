// A toolbar click grants activeTab; side-panel opening alone may not.
export async function currentTab(api = chrome) {
 const [tab] = await api.tabs.query({active:true,lastFocusedWindow:true});
 const select = 'Select your Alma tab, then reopen ScriptShifter using its toolbar icon.';
 if (!Number.isInteger(tab?.id) || tab.id < 0) throw new Error(select);
 let url = tab.url;
 if (!url) {
  try {
   const results = await api.scripting.executeScript({target:{tabId:tab.id},func:()=>location.href});
   url = results[0]?.result;
  } catch {
   throw new Error('Cannot access this tab. ' + select);
  }
 }
 if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Select your Alma HTTPS page, then reopen ScriptShifter using its toolbar icon.');
 return {...tab,url};
}
