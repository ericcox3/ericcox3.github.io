const client = new ChimeWebSDK();
var currentUser;
var contacts = {};
var currentConversation;

window.addEventListener('load', function() {
	setTimeout(init, 500);
});

function init() {
	client.auth.checkIsAuthenticated().then(setLoginStatus);
	client.auth.onAuthStatus(setLoginStatus);
}

function login() {
	client.auth.checkIsAuthenticated().then(function(isAuthenticated) {
		if(!isAuthenticated) {
			client.auth.authenticate();
		}
		else {
			setLoginStatus(isAuthenticated);
		}
	});
}

function logout() {
	client.auth.signOut();
}

function setLoginStatus(isAuthenticated) {
	document.getElementById("login-div").style.display = "none";
	document.getElementById("contacts-div").style.display = "none";
	document.getElementById("chat-div").style.display = "none";
	document.getElementById("loading-div").style.display = "block";
	
	if(isAuthenticated) {
		client.auth.getCurrentUserProfile().then(setCurrentUser);
	}
	else {
		document.getElementById("loading-div").style.display = "none";
		document.getElementById("login-div").style.display = "block";
		document.getElementById("message-div").innerHTML = "";
		var contactSelect = document.getElementById("contact-select");
		while(contactSelect.options.length > 1) {
			contactSelect.remove(contactSelect.options.length - 1);
		}
		currentUser = null;
		currentConversation = null;
		contacts = {};
	}
}

function setCurrentUser(profile) {
	currentUser = profile;
	getIssue();
}

async function addContact(issue) {
	const profile = await client.contact.addContact(issue.fields.assignee.emailAddress);
	contacts[profile.profileId] = profile;
	contacts[profile.profileId].issueKey = issue.key;
	contacts[profile.profileId].issueSummary = issue.fields.summary;
	addToContactSelect(profile);
}

function addToContactSelect(profile) {
	var contactSelect = document.getElementById("contact-select");
	var contactOption = document.createElement("option");
	contactOption.text = "[" + profile.issueKey + "] " + profile.issueSummary;
	contactOption.value = profile.profileId;
	contactSelect.add(contactOption);
}

function createConversation() {
	var contactSelect = document.getElementById("contact-select"); 
	if(contactSelect.selectedIndex != 0) {
		var profileIds = new Array();
			profileIds[0] = contactSelect.value;
			client.chat.createConversation(profileIds).then(function(conversation) {
				currentConversation = conversation;
				var aboutMsg = "About issue " + contactSelect.options[contactSelect.selectedIndex].text;
				client.chat.createConversationMessage(currentConversation.id, aboutMsg).then(function(result) {
					listConversationMsg();
					subscribeToConversationMessages();
				});
				document.getElementById("contacts-div").style.display = "none";
				document.getElementById("chat-div").style.display = "block";
			});
	}
	else {
		alert("Please select a contact first!");
	}
}

function listConversationMsg() {
	client.chat.listConversationMessages(currentConversation.id, { maxResults:5 }).then(function(messages) {
		for(var i = messages.result.length - 1; i >= 0; i--) {
			addMsgToChat(messages.result[i]);
		}
	});
}

function subscribeToConversationMessages() {
	client.chat.onConversationMessage(currentConversation.id, function(result) {
		var message = result.data.record;
		if(message.conversationId == currentConversation.id) {
			addMsgToChat(message);
		}
	});
}

function createConversationMsg(event) {
	var msg = document.getElementById("message-text").value;
	if(event.keyCode == 13 && msg && msg != "") {
		client.chat.createConversationMessage(currentConversation.id, msg).then(function (result) {
			document.getElementById("message-text").value = "";
		});
	}
}
		
function addMsgToChat(msg) {
	if(msg && msg.content) {
		var msgDiv = document.createElement("div");
		var br = document.createElement("br");
		if(msg.sender == currentUser.profileId) {
			msgDiv.classList.add("sender");
			msgDiv.innerHTML = "<strong>" + currentUser.name + ": </strong>" + "&nbsp;";
		}
		else {
			msgDiv.innerHTML = "<strong>" + contacts[msg.sender].name + " (assignee)" + ":</strong>" + "&nbsp;";
		}
		msgDiv.innerHTML+= msg.content;
		msgDiv.classList.add("container");

		var chatDiv = document.getElementById("message-div");
		chatDiv.appendChild(msgDiv);
		chatDiv.scrollTop = chatDiv.scrollHeight;
	}
}

function backToContacts() {
	document.getElementById("chat-div").style.display = "none";
	document.getElementById("contacts-div").style.display = "block";
	document.getElementById("message-div").innerHTML = "";
}
		
function getIssue() {
	var searchJql = 'resolution = null';
	console.log(searchJql);
	AP.require('request', function(request) {
		request({
			url: '/rest/api/latest/search?jql=' + encodeURIComponent(searchJql),
			success: async function(response) {
				// convert the string response to JSON
				response = JSON.parse(response);
				var responseText = JSON.stringify(response);
				console.log(responseText);
				for(var i = 0; i < response.issues.length; i++) {
					if(response.issues[i].fields.assignee && response.issues[i].fields.assignee.emailAddress != currentUser.primaryEmail) {
						await addContact(response.issues[i]);
					}
				}
				document.getElementById("contacts-div").style.display = "block";
				document.getElementById("loading-div").style.display = "none";
			},
			error: function() {
				console.log(arguments);
			}    
		});
	});
}
