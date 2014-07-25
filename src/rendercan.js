var rendercan = (function() {

  function inject(fun, doc) {
    doc = doc || document;
    var script = doc.createElement('script');
    script.textContent = '(' + fun + ')();';
    (doc.head||doc.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
  }

  // inject some globals
  inject(function() {
    window._Date = window.Date;
    window._performanceNow = window.performance.now;
    window._DateOverride = false;
  });

  // inject a date override to local scope
  function overrideDate() {
    inject(function() {
      window._DateOverride = true;
      var RATE = 16.66666666; // 1/60 * 1000
      var current_millis = window._Date.now();
      window.Date = function() {
        if (arguments.length === 0) {
          return new window._Date(current_millis);
        }
        return new window._Date.apply(this, arguments);
      }
      window.Date.prototype = new Date();
      window.Date.now = function() {
        return current_millis;
      };
      window.performance.now = function() {
        return current_millis - window.performance.timing.navigationStart;
      }
      function loop() {
        current_millis += RATE;
        if (window._DateOverride) {
          requestAnimationFrame(loop);
        }
      }
      loop();
    });
  }

  // inject a date restore to local scope
  function restoreDate() {
    inject(function() {
      window._DateOverride = false;
      window.Date = window._Date;
      window.performance.now = window._performanceNow;
    });
  }

  function start() {
    log("Starting.");
    recording = true;

    canvii = document.querySelectorAll("html /deep/ canvas");
    svgs = document.querySelectorAll("html /deep/ svg");

    if( (canvii.length === 0 && svgs.length === 0) || !(window.webkitRequestAnimationFrame || window.requestAnimationFrame)) {
      log("No request animation frame or canvas or svg.");
      // TODO(doug) write an error back to background.js to inform the user.
      alert("Could not find a canvas/svg element. Is it in an iframe?");
      return;
    }

    canviinames = [];
    for (var i=0, l=canvii.length; i<l; i++) {
      var id = canvii[i].id;
      if (id == "") {
        id = "canvas";
      }
      if (canviinames.indexOf(id) != -1) {
        id = id+i;
      }
      canviinames.push(id);
    }

    svgnames = [];
    for (var i=0, l=svgs.length; i<l; i++) {
      var id = svgs[i].id;
      if (id == "") {
        id = "svg";
      }
      if (svgnames.indexOf(id) != -1) {
        id = id+i;
      }
      svgnames.push(id);
    }

    window.requestFileSystem( window.TEMPORARY, 1024*1024, initRecord, errorHandler );
  }

  function stop() {
    log("Stopping.");
    recording = false;
  }

  // Name standardization
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

  // Globals
  var count, recording, fe, fw, canvii, canviinames, svgs, svgnames;

  function initRecord(fs){
    var create = function() {
      fs.root.getFile( "frames.tar", {create: true}, function(fileEntry) {

        // Create a FileWriter object for our FileEntry (log.txt).
        fileEntry.createWriter(function(fileWriter) {

          fileWriter.onwriteend = function(e) {
            if(recording) {
              log("Write end.");
              //ns.requestAnimationFrame(grabFrames);
              window.requestAnimationFrame(grabFrames);
            } else {
              log("Finished.");
              stopRecording();
            }
          };

          fileWriter.onerror = function(e) {
            log('Write failed: ' + e.toString());
          };

          fe = fileEntry;
          fw = fileWriter;

          startRecording()

        }, errorHandler);

      }, errorHandler);
    };
    // delete any previous
    fs.root.getFile( "frames.tar", {create: false}, function(fileEntry) {
      fileEntry.remove(create, errorHandler);
    }, create );
  }

  var svgHeader = '<?xml version="1.0" encoding="utf-8"?> <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"> <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 WIDTH HEIGHT" enable-background="new 0 0 WIDTH HEIGHT" xml:space="preserve">';

  function grabFrames() {
    // write parts to tar
    var parts = [];
    var data;
    for (var i=0,l=canvii.length; i<l; i++) {
      data = dataURItoBlob(canvii[i].toDataURL("image/png"));
      var name = canviinames[i]+"-"+padLeft(count+"", 9)+".png";
      var header = createHeader( name, data.length, "image/png" );
      parts.push(header);
      parts.push(data.bytes);
    }
    for (var i=0,l=svgs.length; i<l; i++) {
      var svg = svgs[i];
      var header = svgHeader.replace(/WIDTH/g, svg.offsetWidth).replace(/HEIGHT/g, svg.offsetHeight);
      svg = header + svg.innerHTML + '</svg>'
      data = dataURItoBlob('data:image/svg+xml;base64,'+btoa(svg));
      var name = svgnames[i]+"-"+padLeft(count+"", 9)+".svg";
      var header = createHeader( name, data.length, "image/svg+xml" );
      parts.push(header);
      parts.push(data.bytes);
    }
    var bb = new window.Blob(parts, {"type": "tar/archive"});
    fw.write(bb);
    count += 1;
  }


  function startRecording() {
    // defer overrideDate to ensure the globals are stashed.
    setTimeout(overrideDate, 0);
    count = 0;
    window.requestAnimationFrame(grabFrames);
  }

  function stopRecording() {
    var url = fe.toURL();
    log("Frames saved to ", url);
    window.open(url, "_newtab");
    count = 0;
    restoreDate();
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
      throw new Error("Incompatible size");
    }
    var l = size-value.length;
    for (var i = 0; i < l; i++) {
      value = "0" + value;
    }
    return value;
  }

  function createHeader( name, size, type ){
    // var ab = new ArrayBufferView(512);
    var ia = new Uint8Array(512);
    var sum = 0;
    sum += dumpString(name, ia, 0, 99);
    sum += dumpString(size.toString(8), ia, 124, 12);
    sum += dumpString(padLeft("644 \0", 8), ia, 100, 8)
      // timestamp
      var ts = new Date().getTime();
    ts = Math.floor(ts/1000);
    sum += dumpString(ts.toString(8), ia, 136, 12);

    // extra header info
    sum += dumpString("0", ia, 156, 1);
    sum += dumpString("ustar ", ia, 257, 6);
    sum += dumpString("00", ia, 263, 2);

    // assume checksum to be 8 spaces
    sum += 8*32;
    //checksum 6 digit octal followed by null and space
    dumpString(padLeft(sum.toString(8)+"\0 ", 8), ia, 148, 8);
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
    log("Error", e);
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[rendercan]");
    console.log.apply(console, args)
  }

  return {
    start: start,
    stop: stop
  };
})();

