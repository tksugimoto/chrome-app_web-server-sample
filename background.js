chrome.app.runtime.onLaunched.addListener(function(launchData) {
	chrome.app.window.create("index.html", {
		"bounds": {
			"width":  200,
			"height": 300,
			"top":  0,
			"left": 0
		}
	});
});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	console.log(arguments);
});

var socketId;
var host = "127.0.0.1";
var port = 9000;

chrome.storage.local.set({
	host: host,
	port: port
});

var img = document.getElementById("img");
img.onload = function (){
	var canvas = document.getElementById("canvas");
	canvas.width = img.width;
	canvas.height = img.height;
	var ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0);
};

chrome.sockets.tcpServer.create(function(createInfo) {
	console.log("chrome.sockets.tcpServer.create", createInfo);
	socketId = createInfo.socketId;

	chrome.sockets.tcpServer.listen(socketId, host, port, function(result) {
		console.log("chrome.sockets.tcpServer.listen", result);
	});
});

chrome.sockets.tcpServer.onAccept.addListener(function(info) {
	//console.log("chrome.sockets.tcpServer.onAccept.addListener", info);
	if (info.socketId === socketId) {
		var paused = false;
		chrome.sockets.tcp.setPaused(info.clientSocketId, paused);
	}
});

chrome.sockets.tcp.onReceive.addListener(function(info) {
	var clientSocketId = info.socketId;
	var requestText = arrayBuffer2string(info.data);
	
	var path = null;
	if (requestText.match(/^GET ([^ ]+) HTTP/)) {
		path = RegExp.$1;
	}
	console.log("chrome.sockets.tcp.onReceive", path, requestText.split("\n")[0], info, requestText);
	
	if (path === "/favicon.ico") {
		// TODO: iconの大きさも一緒に返している気がする
		var type = "image/png";
		var dataUrl = canvas.toDataURL(type);
		var image = atob(dataUrl.split(',')[1]);
		var header = [
			"HTTP/1.1 200 OK",
			"Content-Type: image/png"
		].join("\n");
		var responseText = header + "\n\n" + image;
		var arrayBuffer = string2arrayBuffer(responseText, "notUTF8");
		chrome.sockets.tcp.send(clientSocketId, arrayBuffer, function(info) {
			chrome.sockets.tcp.disconnect(clientSocketId);
			chrome.sockets.tcp.close(clientSocketId);
		});
		
		return;
		// こちらはhttp://127.0.0.1:9000/favicon.icoにアクセスした時に表示されない
		var filePath = "icon/icon-128.png";
		var xhr = new XMLHttpRequest();
		xhr.open("GET", filePath);
		xhr.onload = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					var body = xhr.responseText;
					var header = [
						"HTTP/1.1 200 OK",
						"Content-Type: image/png"
					].join("\n");
					var responseText = header + "\n\n" + body;
					var arrayBuffer = string2arrayBuffer(responseText, "notUTF8");
					chrome.sockets.tcp.send(clientSocketId, arrayBuffer, function(info) {
						chrome.sockets.tcp.disconnect(clientSocketId);
						chrome.sockets.tcp.close(clientSocketId);
					});
				} else {
					notFound(clientSocketId);
				}
			}
		};
		xhr.send(null);
	} else if (path === "/" || path === "/index.html") {
		var filePath = "file/index.html";
		var xhr = new XMLHttpRequest();
		xhr.open("GET", filePath);
		xhr.onload = function() {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) {
					var body = xhr.responseText;
					var header = [
						"HTTP/1.1 200 OK",
						"Content-Type: text/html"
					].join("\n");
					var responseText = header + "\n\n" + body;
					var arrayBuffer = string2arrayBuffer(responseText);
					chrome.sockets.tcp.send(clientSocketId, arrayBuffer, function(info) {
						chrome.sockets.tcp.disconnect(clientSocketId);
						chrome.sockets.tcp.close(clientSocketId);
					});
				} else {
					notFound(clientSocketId);
				}
			}
		};
		xhr.send(null);
	} else {
		notFound(clientSocketId);
	}
});

function notFound(clientSocketId){
	var message = '<title>404 page not found</title><link rel="icon" href="/favicon.ico" type="image/png" />ページが見つかりません';
	var header = [
		"HTTP/1.1 200 OK",
		"Content-Type: text/html; charset=utf-8",
//		"Content-Length: " + message.length//この指定をすると日本語が含まれている場合に途中で切れる
	].join("\n");
	var responseText = header + "\n\n" + message;
	var arrayBuffer = string2arrayBuffer(responseText);
	chrome.sockets.tcp.send(clientSocketId, arrayBuffer, function(info) {
		chrome.sockets.tcp.disconnect(clientSocketId);
		chrome.sockets.tcp.close(clientSocketId);
	});
}

function string2arrayBuffer(string, notUTF8) {
	if (notUTF8) {
		var uint8Array = new Uint8Array(string.length);
		for (var i = 0, len = uint8Array.length; i < len; i++) {
			uint8Array[i] = string.charCodeAt(i);
		}
		return uint8Array.buffer;
	} else {
		// UTF-8
		return new TextEncoder("utf-8").encode(string).buffer;
	}
}

function arrayBuffer2string(arrayBuffer, encoding) {
	if (!encoding) encoding = "utf-8";
	var uint8Array = new Uint8Array(arrayBuffer);
	return new TextDecoder(encoding).decode(uint8Array);
	
	// UTF-8 未対応
	var uint8Array = new Uint8Array(arrayBuffer);
	var string = "";
	for (var i = 0, len = uint8Array.length; i < len; i++) {
		string += String.fromCharCode(uint8Array[i]);
	}
	return string;
}