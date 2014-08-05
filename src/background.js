var STATE = {
  record: 'record',
  recording: 'recording',
  stop: 'stop',
  stopped: 'stopped',
  paused: 'paused'
};

var recording_tab;

var state = STATE.stopped;

chrome.browserAction.setIcon({
  path: 'images/icon-default-38.png'
});

function setIcon() {
  switch(state) {
    case STATE.paused:
      chrome.browserAction.setIcon({
        path: 'images/icon-saving-38.png'
      });
      break;
    case STATE.recording:
      var flipflop = 1;
      var pulse = function() {
        if (state === STATE.recording) {
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
          setIcon();
        }
      };
      pulse();
      break;
    case STATE.stopped:
      chrome.browserAction.setIcon({
        path: 'images/icon-default-38.png'
      });
      break;
  }
}

chrome.runtime.onMessage.addListener(function(req,src,resp) {
  if (!req.rendercan) {
    return;
  }
  state = req.rendercan;
  setIcon();
});

chrome.browserAction.onClicked.addListener(function(tab) {

  var tab_id = tab.id;

  function inject(src, callback) {
    var injection = [
      'var s = document.createElement("script");',
      's.src = "' + src + '";',
      's.onload = function() { this.parentNode.removeChild(this); };',
      '(document.head||document.documentElement).appendChild(s);',
      'window.addEventListener("message", function(evt) {',
        'if (evt.source !== window) return;',
        'chrome.runtime.sendMessage(evt.data);',
      '});',
      'chrome.runtime.onMessage.addListener(function(req,src,resp) {',
        'window.postMessage(req, "*");',
      '});',
      'var rendercan = {};' // define rendercan so we can test if it is injected
    ].join('\n');
    chrome.tabs.executeScript(tab_id, { code: injection }, callback);
  }

  function send(msg, callback) {
    chrome.tabs.sendMessage(tab_id, msg, callback);
  }

  function start_recording() {
    recording_tab = tab_id;
    console.log('[rendercan] start recording on tab ', tab_id);

    chrome.browserAction.setIcon({
      path: 'images/icon-saving-38.png'
    });

    state = STATE.record;
    send({rendercan: state});
  }

  function stop_recording() {
    recording_tab = undefined;
    console.log('[rendercan] stop recording on tab ', tab_id);

    state = STATE.stop;
    send({rendercan: state});

    chrome.browserAction.setIcon({
      path: 'images/icon-saving-38.png'
    });
  }

  function toggle() {
    chrome.tabs.executeScript(tab_id, {
      code: '!this.rendercan;'
    }, function(results) {
      if (results[0] === true) {
        // doesn't exist
        inject(chrome.extension.getURL('rendercan.js'), start_recording);
      } else {
        // exists
        if (state === STATE.recording || state === STATE.record) {
          stop_recording();
        } else {
          start_recording();
        }
      }
    });
  }

  // TODO(doug): on unload or refrest stop.

  if (recording_tab !== undefined) {
    tab_id = recording_tab;
    // TODO(doug): add try catch if the recording tab has been removed.
    chrome.tabs.update(recording_tab, {selected: true});
  }
  toggle();

});

