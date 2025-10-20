function checkTab(tabId, data, tab: chrome.tabs.Tab) {
  if (tab.url && tab.url.indexOf('fantasysports.yahoo.com/nba') > -1) {
    chrome.pageAction.show(tabId);
  }
}



chrome.tabs.onUpdated.addListener(checkTab);
