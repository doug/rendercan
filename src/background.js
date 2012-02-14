chrome.browserAction.onClicked.addListener( function(tab) {

  if (recording[tab.id]) {
    console.log("Rendercan: stop recording on tab ", tab.id);
    recording = false;
    // post stop
    chrome.tabs.executeScript(tab.id, { code: 'rendercan.stop();' });
  } else {
    console.log("Rendercan: start recording on tab ", tab.id);
    recording[tab.id] = true;
    if (!loaded[tab.id]) {
      //inject script
      loaded[tab.id] = true;
      chrome.tabs.executeScript(tab.id, {
        file: 'rendercan.js'
      }, function() {
        // post start
        chrome.tabs.executeScript(tab.id, { code: 'rendercan.start();' });
      });
    } else {
      // post start
      chrome.tabs.executeScript(tab.id, { code: 'rendercan.start();' });
    }
  }

});

var recording = {};
var loaded = {};


