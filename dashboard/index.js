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
	client.auth.authenticate();
}

function logout() {
	client.auth.signOut();
}

function setLoginStatus(isAuthenticated) {
	document.getElementById("login-link").style.display = (isAuthenticated)?"none" : "block";
	document.getElementById("logout-link").style.display = (isAuthenticated)?"block" : "none";
	document.getElementById("loading-div").style.display = "none";
	document.getElementById("main-tab").style.display = "block";
	
	if(isAuthenticated) {
		client.auth.getCurrentUserProfile().then(setCurrentUser); 
	}
	else {
		document.getElementById("currentUser").innerHTML = "";
		document.getElementById("sideBar").innerHTML = "";
		document.getElementById("chatBox").innerHTML = "";
		currentUser = null;
		currentConversation = null;
		contacts = {};
	}
}

function setCurrentUser(profile) {
	currentUser = profile;
	document.getElementById("currentUser").innerHTML = currentUser.name;
	getIssue();
}

async function addIssuesContact(issue) {
	if(issue.assignee && issue.assignee.emailAddress != currentUser.primaryEmail) {
		const profile = await client.contact.addContact(assignee.emailAddress);
		contacts[profile.profileId] = profile;
		addToContactsBar(issue, profile);
	}
}

function addToContactsBar(issue, profile) {
	var contactDiv = document.createElement("div");
	contactDiv.innerHTML = issue.key + ": " + issue.fields.summary;
	contactDiv.classList.add("contact");
	contactDiv.onclick = function() {
		var contactDivs = document.getElementsByClassName("contact");
		for(var i = 0; i < contactDivs.length; i++)
			contactDivs.item(i).style.borderStyle = "none";	
		contactDiv.style.borderStyle = "solid";
		createConversation(profile.profileId, issue);
	}
	
	var contactsBar = document.getElementById("sideBar");
	contactsBar.appendChild(contactDiv);
}

function createConversation(profileId, issue) {
	var profileIds = new Array();
	profileIds[0] = profileId;
	client.chat.createConversation(profileIds).then(function(conversation) {
		currentConversation = conversation;
		listConversationMsg(issue);
		subscribeToConversationMessages();
	});
}

function listConversationMsg(issue) {
	document.getElementById("chatBox").innerHTML = "";
	client.chat.listConversationMessages(currentConversation.id, { maxResults:5 }).then(function(messages) {
		for(var i = messages.result.length - 1; i >= 0; i--) {
			addMsgToChat(messages.result[i]);
		}
		var msg = "About issue [" + issue.key + "]: " + issue.fields.summary;
		client.chat.createConversationMessage(currentConversation.id, msg);
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
	if(event.keyCode == 13) {
		var msg = document.getElementById("msg-text").value;
		client.chat.createConversationMessage(currentConversation.id, msg).then(function (result) {
			document.getElementById("msg-text").value = "";
		});
	}
}
		
function addMsgToChat(msg) {
	var msgDiv = document.createElement("div");
	var br = document.createElement("br");
	if(msg.sender == currentUser.profileId) {
		msgDiv.classList.add("darker");
		msgDiv.innerHTML = "<strong>" + currentUser.name + ":</strong><br />";
	}
	else {
		msgDiv.innerHTML = "<strong>" + contacts[msg.sender].name + ":</strong><br />";
	}
	msgDiv.innerHTML+= msg.content;
	msgDiv.classList.add("container");

	var chatDiv = document.getElementById("chatBox");
	chatDiv.appendChild(msgDiv);
	chatDiv.scrollTop = chatDiv.scrollHeight;
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
					await addIssuesContact(response.issues[i]);
				}
				/*var reporter = response.issues[0].fields.reporter;
				if(reporter.emailAddress != currentUser.primaryEmail)
					await addContact(reporter.emailAddress);
				var assignee = response.issues[0].fields.assignee;
				if(assignee && assignee.emailAddress != reporter.emailAddress && assignee.emailAddress != currentUser.primaryEmail)
					await addContact(assignee.emailAddress);*/
			},
			error: function() {
				console.log(arguments);
			}    
		});
	});
}
