chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      console.log(sender.tab ?
        "from a content script:" + sender.tab.url :
        "from the extension");

      if (request.action == "record") {

        if (recording) {
          console.log("stopping");
          recording = false;
        } else {
          console.log("starting");
          recording = true;
          sendResponse("recording");

          canvas = document.querySelector("canvas");

          if( !canvas || !window.webkitRequestAnimationFrame) {
            console.log("no request animation frame...");
            return;
          }

          window.webkitRequestFileSystem( window.TEMPORARY, 1024*1024, initRecord, errorHandler );
        }
      } else {
        sendResponse({}); // snub them.
      }
    });

var count, recording, fe, fw, canvas;

function initRecord(fs){
  fs.root.getFile( "frames.tar", {create: true}, function(fileEntry) {

    // Create a FileWriter object for our FileEntry (log.txt).
    fileEntry.createWriter(function(fileWriter) {

      fileWriter.onwriteend = function(e) {
        if(recording) {
          window.webkitRequestAnimationFrame(grabFrames);
        } else {
          console.log("done");
          stopRecording();
        }
      };

      fileWriter.onerror = function(e) {
        console.log('Write failed: ' + e.toString());
      };

      fe = fileEntry;
      fw = fileWriter;

      startRecording()

    }, errorHandler);

  }, errorHandler);

}

function grabFrames() {
  grabFrame();
}

function grabFrame(){
  count += 1;
  data = dataURItoBlob(canvas.toDataURL("image/png"));
  var name = "image-"+padLeft(count+"", 5)+".png";
  var header = createHeader( name, data.byteLength, "image/png" );
  var bb = new window.WebKitBlobBuilder();
  bb.append(header);
  bb.append(data)
  fw.write(bb.getBlob('tar/archive'));
}


function startRecording(canvas) {
  count = 0;
  grabFrames();
}

function stopRecording() {
  var url = fe.toURL();
  console.log(url);
  document.body.innerHTML = "<a href='"+url+"'>link</a>";
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
  console.log(e);
}

