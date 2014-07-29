chrome.browserAction.onClicked.addListener(function(tab) {

    function inject_rendercan(callback) {
      chrome.tabs.executeScript(tab.id, { file: 'rendercan.js' }, callback);
    }

    function start_recording() {
      console.log("[rendercan] start recording on tab ", tab.id);

      chrome.tabs.executeScript(tab.id, { code: 'rendercan.start();' });

      // pulse the recording icon
      var flipflop = 1;
      var pulse = function() {
        chrome.tabs.executeScript(tab.id, {
          code: 'this.rendercan && this.rendercan.recording;'
        }, function(results) {
          if (results[0] === true) {
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
          } else {
            // reset icon to default on page change
            chrome.browserAction.setIcon({
              path: 'images/icon-default-38.png'
            });
          }
        });
      };
      pulse();

    }

    function stop_recording() {
      chrome.browserAction.setIcon({
        path: 'images/icon-saving-38.png'
      });
      console.log("[rendercan] stop recording on tab ", tab.id);
      // post stop
      chrome.tabs.executeScript(tab.id, { code: 'rendercan.stop();' }, function() {
        chrome.browserAction.setIcon({
          path: 'images/icon-default-38.png'
        });
      });
    }

    chrome.tabs.executeScript(tab.id, {
      code: '!this.rendercan;'
    }, function(results) {
      if (results[0] === true) {
        // doesn't exist
        inject_rendercan(start_recording)
      } else {
        // exists
        chrome.tabs.executeScript(tab.id, {
          code: '!this.rendercan.recording;'
        }, function(results) {
          if (results[0] === true) {
            // not recording
            start_recording();
          } else {
            stop_recording();
          }
        });
      }
    });

});

