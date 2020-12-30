webpackJsonp([3],{

/***/ 16:
/***/ (function(module, exports) {

function checkTab(tabId, data, tab) {
    if (tab.url && tab.url.indexOf('fantasysports.yahoo.com/nba/34679') > -1) {
        chrome.pageAction.show(tabId);
    }
}
chrome.tabs.onUpdated.addListener(checkTab);


/***/ })

},[16]);