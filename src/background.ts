function checkTab(tabId, data, tab: chrome.tabs.Tab) {
  console.log('check')
  if (tab.url && tab.url.indexOf('fantasysports.yahoo.com/nba/39876') > -1) {
    console.log(true)
    chrome.pageAction.show(tabId);
  }
}
chrome.tabs.onUpdated.addListener(checkTab);