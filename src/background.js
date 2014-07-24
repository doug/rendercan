chrome.browserAction.onClicked.addListener(function(tab) {

  if (recording[tab.id]) {
    chrome.browserAction.setIcon({
      path: 'images/RenderCan-5.png'
    })
    console.log("[rendercan] stop recording on tab ", tab.id);
    recording[tab.id] = false;
    // post stop
    chrome.tabs.executeScript(tab.id, { code: 'rendercan.stop();' }, function() {
      chrome.browserAction.setIcon({
        path: 'images/RenderCan-4.png'
      })
    });
  } else {
    chrome.browserAction.setIcon({
      path: 'images/RenderCan-3.png'
    })
    console.log("[rendercan] start recording on tab ", tab.id);
    recording[tab.id] = true;
    if (!loaded[tab.id]) {
      loaded[tab.id] = true;
      //inject script
      chrome.tabs.executeScript(tab.id, { file: 'rendercan.js' }, function() {
        // post start
        chrome.tabs.executeScript(tab.id, { code: 'rendercan.start();' });
      });
    } else {
      // post start
      chrome.tabs.executeScript(tab.id, { code: 'rendercan.start();' });
    }
  }

});

// clean up after ourselves
chrome.tabs.onRemoved.addListener(function(tab_id) {
  delete recording[tab_id];
  delete loaded[tab_id];
});

var recording = {};
var loaded = {};


