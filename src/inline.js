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
			console.log( 'writing', count );
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
	console.log("grabbing frame");
	count += 1;
	data = dataURItoBlob(canvas.toDataURL("image/png"));
	var name = "image-"+count+".png";
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

function createHeader( name, size, type ){
	var ab = new ArrayBuffer(512);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < name.length; i++) {
        ia[i] = name.charCodeAt(i);
    }
    ia[128] = size >> 56
    ia[129] = size >> 48
    ia[130] = size >> 40
    ia[131] = size >> 32
    ia[132] = size >> 24
    ia[133] = size >> 16
    ia[134] = size >> 8
    ia[135] = size
    return ab;
	// var bb = new window.WebKitBlobBuilder();
 //    bb.append(ab);
 //    return bb.getBlob(type);
}

function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return ab;
    // // write the ArrayBuffer to a blob, and you're done
    // var bb = new window.WebKitBlobBuilder();
    // bb.append(ab);
    // return bb.getBlob(mimeString);
}

function errorHandler( e ){
	console.log(e);
}

