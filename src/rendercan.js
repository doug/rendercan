var rendercan = (function() {

  window.addEventListener('message', function(evt) {
    switch(evt.data.rendercan) {
      case 'record':
        record();
        break;
      case 'stop':
        stop();
        break;
      default:
        break;
    }
  });

  window.onbeforeunload = function() {
    if (recording) {
      var resp = confirm([
        'You are currently recording with RenderCan, ',
        'are you sure you want to navigate away?'
        ].join(''));
      return resp;
    }
  }


  // inject some globals
  // Date
  var _Date = window.Date;
  var _performanceNow = window.performance.now;
  var _requestAnimationFrame= window.requestAnimationFrame;
  var _cancelAnimationFrame = window.cancelAnimationFrame;
  var _RAFqueue = [];
  var RATE = 1/60 * 1000;
  var current_millis = _Date.now();
  var QUOTA = 1024*1024*1024*10; // 10 Gb

  // inject a date override to local scope
  function override() {
    // RAF
    var request;
    // var lastRun;
    window.requestAnimationFrame = function(callback, element) {
      // add to pool
      _RAFqueue.push(callback);
      return callback;
    }
    window.cancelAnimationFrame = function(callback) {
      var i = _RAFqueue.indexOf(callback);
      if (i < 0) { return; }
      _RAFqueue.splice(i,1);
    }
    // Date
    current_millis = _Date.now();
    window.Date = function() {
      if (arguments.length === 0) {
        return new _Date(current_millis);
      }
      return new _Date.apply(this, arguments);
    }
    window.Date.prototype = new Date();
    window.Date.now = function() {
      return current_millis;
    };
    window.performance.now = function() {
      return current_millis - window.performance.timing.navigationStart;
    };
  }

  // inject a date restore to local scope
  function restore() {
    // RAF
    window.requestAnimationFrame = _requestAnimationFrame;
    window.cancelAnimationFrame = _cancelAnimationFrame;
    // Date
    window.Date = _Date;
    window.performance.now = _performanceNow;

    // flush RAF
    var toRun = _RAFqueue.splice(0, _RAFqueue.length);
    var now = Date.now();
    toRun.forEach(function(callback) {
      callback(now);
    });
  }

  function record() {
    log('Starting.');
    recording = true;
    canvii = document.querySelectorAll('html /deep/ canvas');
    svgs = document.querySelectorAll('html /deep/ svg');

    if (canvii.length === 0 && svgs.length === 0) {
      log('No canvas or svg found on the page.');
      // TODO(doug) write an error back to background.js to inform the user.
      alert('Could not find a canvas/svg element. Is it in an iframe?');
      window.postMessage({rendercan: 'stopped'}, '*');
      return;
    }

    canviinames = [];
    for (var i=0, l=canvii.length; i<l; i++) {
      var id = canvii[i].id;
      if (id == '') {
        id = 'canvas';
      }
      if (canviinames.indexOf(id) != -1) {
        id = id+i;
      }
      canviinames.push(id);
    }

    svgnames = [];
    for (var i=0, l=svgs.length; i<l; i++) {
      var id = svgs[i].id;
      if (id == '') {
        id = 'svg';
      }
      if (svgnames.indexOf(id) != -1) {
        id = id+i;
      }
      svgnames.push(id);
    }

    override();
    count = 0;
    window.requestFileSystem( window.TEMPORARY, QUOTA, initRecord, errorHandler );
  }

  function stop() {
    log('Stopping.');
    recording = false;
  }

  // Name standardization
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

  // Globals
  var count, recording, fe, fw, canvii, canviinames, svgs, svgnames;

  function initRecord(fs) {
    var create = function() {
      fs.root.getFile('frames.tar', {create: true}, function(fileEntry) {
      
        window.postMessage({rendercan: 'recording'}, '*');

        // Create a FileWriter object for our FileEntry (log.txt).
        fileEntry.createWriter(function(fileWriter) {

          var rafRequest;
          var hasError = false;

          fileWriter.onwriteend = function(e) {
            if (hasError) {
              return;
            }
            if(recording) {
              log('Write end.');
              rafRequest = _requestAnimationFrame(draw);
            } else {
              log('Finished.');
              stopRecording();
              // restore record in case of multiple writes
              record = rendercan.record;
            }
          };

          fileWriter.onerror = function(e) {
            log('Write failed: ', e.currentTarget.error);
            // if (e.currentTarget.error.name === 'QuotaExceededError') {
            //   hasError = true;
            //   _cancelAnimationFrame(rafRequest);
            //   download();
            //   window.postMessage({rendercan: 'paused'}, '*');
            //   // override record
            //   record = function() {
            //     hasError = false;
            //     window.requestFileSystem( window.TEMPORARY, QUOTA, initRecord, errorHandler );
            //   }
            // } else {
              stop();
            // }
          };

          fe = fileEntry;
          fw = fileWriter;

          _requestAnimationFrame(draw);

        }, errorHandler);

      }, errorHandler);
    };
    // delete any previous
    fs.root.getFile('frames.tar', {create: false}, function(fileEntry) {
      fileEntry.remove(create, errorHandler);
    }, create);
  }

  var svgHeader = '<?xml version="1.0" encoding="utf-8"?> <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"> <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 WIDTH HEIGHT" enable-background="new 0 0 WIDTH HEIGHT" xml:space="preserve">';

  function grabFrames() {
    // write parts to tar
    var parts = [];
    var data;
    for (var i=0,l=canvii.length; i<l; i++) {
      data = dataURItoBlob(canvii[i].toDataURL('image/png'));
      var name = canviinames[i]+'-'+padLeft(count+'', 9)+'.png';
      var header = createHeader( name, data.length, 'image/png' );
      parts.push(header);
      parts.push(data.bytes);
    }
    for (var i=0,l=svgs.length; i<l; i++) {
      var svg = svgs[i];
      var header = svgHeader.replace(/WIDTH/g, svg.offsetWidth).replace(/HEIGHT/g, svg.offsetHeight);
      svg = header + svg.innerHTML + '</svg>'
      data = dataURItoBlob('data:image/svg+xml;base64,'+btoa(svg));
      var name = svgnames[i]+'-'+padLeft(count+'', 9)+'.svg';
      var header = createHeader( name, data.length, 'image/svg+xml' );
      parts.push(header);
      parts.push(data.bytes);
    }
    var bb = new window.Blob(parts, {'type': 'tar/archive'});
    fw.write(bb);
    count += 1;
  }

  function draw() {
    // Update the current time by constant tick
    current_millis += RATE;
    
    // Execute things queued for the RAF
    // must copy from RAFqueue first because it is modified by callbacks
    var toRun = _RAFqueue.splice(0, _RAFqueue.length);
    toRun.forEach(function(callback) {
      callback(current_millis);
    });

    // Write the frame
    grabFrames();
  }

  function download() {
    var url = fe.toURL();
    log('Frames saved to ', url);
    var a = document.createElement('a');
    a.style = 'display: none';
    document.body.appendChild(a);
    a.href = url;
    a.download = 'frames.tar';
    a.click();
  }

  function stopRecording() {
    // TODO(doug): delete the frames after download
    download();
    window.postMessage({rendercan: 'stopped'}, '*');
    count = 0;
    restore();
  }

  function dumpString(value, ia, off, size) {
    var i,x;
    var sum = 0;
    var len = Math.min(value.length, size);
    for (i = 0; i < len; i++) {
      x = value.charCodeAt(i);
      ia[off] = x;
      sum += x;
      off += 1;
    }
    return sum;
  }

  function padLeft(value, size) {
    if (size < value.length) {
      throw new Error('Incompatible size');
    }
    var l = size-value.length;
    for (var i = 0; i < l; i++) {
      value = '0' + value;
    }
    return value;
  }

  function createHeader( name, size, type ){
    // var ab = new ArrayBufferView(512);
    var ia = new Uint8Array(512);
    var sum = 0;
    sum += dumpString(name, ia, 0, 99);
    sum += dumpString(size.toString(8), ia, 124, 12);
    sum += dumpString(padLeft('644 \0', 8), ia, 100, 8)
      // timestamp
      var ts = new Date().getTime();
    ts = Math.floor(ts/1000);
    sum += dumpString(ts.toString(8), ia, 136, 12);

    // extra header info
    sum += dumpString('0', ia, 156, 1);
    sum += dumpString('ustar ', ia, 257, 6);
    sum += dumpString('00', ia, 263, 2);

    // assume checksum to be 8 spaces
    sum += 8*32;
    //checksum 6 digit octal followed by null and space
    dumpString(padLeft(sum.toString(8)+'\0 ', 8), ia, 148, 8);
    return ia;
  }

  function dataURItoBlob(dataURI, pad) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // pad the data into 512 blocks per tar spec
    var padding = 512 - (byteString.length % 512);
    // if divisible by 512 no padding is needed
    if (padding === 512) {
      padding = 0;
    }
    // write the bytes of the string to an ArrayBuffer
    var ia = new Uint8Array(byteString.length + padding);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return {
      bytes: ia,
      length: byteString.length
    };
  }

  function errorHandler( e ){
    log('Error', e);
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[rendercan]');
    console.log.apply(console, args)
  }

  return {
    record: record,
    stop: stop
  };
})();

