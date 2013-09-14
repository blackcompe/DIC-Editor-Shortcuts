//TODO fix
//Port: Could not establish connection. Receiving end does not exist.
//Error in event handler: TypeError: Cannot read property 'val' of undefined

chrome.runtime.onMessage.addListener(
	function(msg, sender, sendResponse) {
		if (msg.text === "urlBinding")
		{
			$("#clipboard").val('');
			$("#clipboard").focus();
			document.execCommand('paste');
			var contents = $("#clipboard").val();
			if(contents.match("^https?://"))
				sendResponse({val: contents});
		}
	}
);