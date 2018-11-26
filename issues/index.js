const client = new ChimeWebSDK();
var currentUser;
var contacts = {};
var currentConversation;
var conversationMsgs = new Array();

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

async function addContact(email, role) {
	const profile = await client.contact.addContact(email);
	contacts[profile.profileId] = profile;
	contacts[profile.profileId].role = role;
	addToContactSelect(profile);
}

function addToContactSelect(profile) {
	var contactSelect = document.getElementById("contact-select");
	var contactOption = document.createElement("option");
	contactOption.text = profile.name + " (" + profile.role + ")";
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
				listConversationMsg();
				subscribeToConversationMessages();
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
	msg = msg.trim();
	if(event.keyCode == 13 && msg) {
		client.chat.createConversationMessage(currentConversation.id, msg).then(function (result) {
			addMsgToChat(result);
		});
		document.getElementById("message-text").value = "";
	}
}
		
function addMsgToChat(msg) {
	if(msg && msg.content && !conversationMsgs.includes(msg.id)) {
		conversationMsgs.push(msg.id);
		var msgDiv = document.createElement("div");
		var br = document.createElement("br");
		if(msg.sender == currentUser.profileId) {
			msgDiv.classList.add("sender");
			msgDiv.innerHTML = "<strong>" + currentUser.name + ": </strong>" + "&nbsp;";
		}
		else {
			msgDiv.innerHTML = "<strong>" + contacts[msg.sender].name + " (" + contacts[msg.sender].role + ")" + ":</strong>" + "&nbsp;";
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
	var urlParams = new URLSearchParams(window.location.search);
	var searchJql = 'issueKey = ' + urlParams.get("issue_key");
	console.log(searchJql);
	AP.require('request', function(request) {
		request({
			url: '/rest/api/latest/search?jql=' + encodeURIComponent(searchJql),
			success: async function(response) {
				// convert the string response to JSON
				response = JSON.parse(response);
				var responseText = JSON.stringify(response);
				console.log(responseText);
				var isValidIssue = false;
				var reporter = response.issues[0].fields.reporter;
				if(reporter.emailAddress != currentUser.primaryEmail) {
					await addContact(reporter.emailAddress, "reporter");
					isValidIssue = true;
				}
				var assignee = response.issues[0].fields.assignee;
				if(assignee && assignee.emailAddress != reporter.emailAddress && assignee.emailAddress != currentUser.primaryEmail) {
					await addContact(assignee.emailAddress, "assignee");
					isValidIssue = true;
				}
				document.getElementById("loading-div").style.display = "none";
				document.getElementById("contacts-div").style.display = "block";
				if(!isValidIssue) {
					alert("No one except you is involved in this issue, so no contact to chat with!")
				}
			},
			error: function() {
				console.log(arguments);
			}    
		});
	});
}
