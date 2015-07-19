
chrome.storage.local.get(["host", "port"], function (items){
	console.log(items);
	if (items.host && items.port) {
		var link = document.getElementById("link");
		link.href = "http://" + items.host + ":" + items.port;
		link.style.display = "block";
	}
});