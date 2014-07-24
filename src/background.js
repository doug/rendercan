chrome.browserAction.onClicked.addListener(function(tab) {

  if (recording[tab.id]) {
    chrome.browserAction.setIcon({
      path: 'images/icon-saving-38.png'
    })
    console.log("[rendercan] stop recording on tab ", tab.id);
    recording[tab.id] = false;
    // post stop
    chrome.tabs.executeScript(tab.id, { code: 'rendercan.stop();' }, function() {
      chrome.browserAction.setIcon({
        path: 'images/icon-default-38.png'
      })
    });
  } else {
    console.log("[rendercan] start recording on tab ", tab.id);
    recording[tab.id] = true;

    // pulse the recording icon
    var flipflop = 1;
    var pulse = function() {
      if (recording[tab.id] != true) {
        return;
      }
      flipflop *= -1;
      if (flipflop > 0) {
        chrome.browserAction.setIcon({
          path: 'images/icon-recording-38.png'
        });
      } else {
        chrome.browserAction.setIcon({
          path: 'images/icon-recording-pulse-38.png'
        });
      }
      setTimeout(pulse, 600);
    };
    pulse();

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


