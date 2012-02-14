var rendercan = (function() {

  function start() {
    log("Starting.");
    recording = true;

    canvii = document.querySelectorAll("canvas");

    if( canvii.length == 0 || !window.requestAnimationFrame) {
      log("No request animation frame or canvas");
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

    window.requestFileSystem( window.TEMPORARY, 1024*1024, initRecord, errorHandler );
  }

  function stop() {
    log("Stopping.");
    recording = false;
  }

  // Name standardization
  //window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  //window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;
  //window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

  // Name standardization
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder;

  var ns = {};
  ns.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  // Don't actually need requestAnimationFrame because we are not disk limited.
  ns.requestAnimationFrame = function(callback) { callback.call(); };

  var RAFcallbacks = [];

  function RAFreplace() {
    window.requestAnimationFrame = function(callback) {
      RAFcallbacks.push(callback);
    }
    window.webkitRequestAnimationFrame = window.requestAnimationFrame;
  }

  function RAFtrigger() {
    RAFcallbacks.forEach(function(callback,i) {
      callback.call();
    });
    RAFcallbacks = [];
  }

  RAFreplace();

  // Globals
  var count, recording, fe, fw, canvii, canviinames;

  function initRecord(fs){
    var create = function() {
      fs.root.getFile( "frames.tar", {create: true}, function(fileEntry) {

        // Create a FileWriter object for our FileEntry (log.txt).
        fileEntry.createWriter(function(fileWriter) {

          fileWriter.onwriteend = function(e) {
            if(recording) {
              ns.requestAnimationFrame(grabFrames);
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

  function grabFrames(){
    var bb = new window.BlobBuilder();
    for (var i=0,l=canvii.length; i<l; i++) {
      data = dataURItoBlob(canvii[i].toDataURL("image/png"));
      var name = canviinames[i]+"-"+padLeft(count+"", 9)+".png";
      var header = createHeader( name, data.byteLength, "image/png" );
      bb.append(header);
      bb.append(data)
    }
    fw.write(bb.getBlob('tar/archive'));
    count += 1;
    RAFtrigger();
  }


  function startRecording() {
    count = 0;
    ns.requestAnimationFrame(grabFrames);
  }

  function stopRecording() {
    var url = fe.toURL();
    log("Frames saved to ", url);
    window.open(url, "_newtab");
    //document.body.innerHTML = "<a href='"+url+"'>link</a>";
    count = 0;
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
    var ab = new ArrayBuffer(512);
    var ia = new Uint8Array(ab);
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
    dumpString(padLeft(sum.toString(8)+"\0 ", 8), ia, 148, 8)
      return ab;
  }

  function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to an ArrayBuffer
    var padding = 512 - (byteString.length % 512);
    var ab = new ArrayBuffer(byteString.length + padding);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return ab;
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

