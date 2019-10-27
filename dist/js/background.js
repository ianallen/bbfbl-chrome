webpackJsonp([4],{

/***/ 17:
/***/ (function(module, exports) {

function checkTab(tabId, data, tab) {
    if (tab.url && tab.url.indexOf('fantasysports.yahoo.com/nba/2662') > -1) {
        chrome.pageAction.show(tabId);
    }
}
chrome.tabs.onUpdated.addListener(checkTab);


/***/ })

},[17]);