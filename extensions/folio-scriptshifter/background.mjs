// Handle the toolbar action explicitly: Chrome grants activeTab for this click.
// Opening through automatic side-panel behavior alone may lack that grant.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false});
});
chrome.action.onClicked.addListener(tab => {
  if (Number.isInteger(tab.id)) {
    // Keep this call inside the original user gesture; do not await other work.
    chrome.sidePanel.open({tabId:tab.id}).catch(error => console.error('Could not open ScriptShifter:',error.message));
  }
});
