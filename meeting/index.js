const client = new ChimeWebSDK();
var currentUser;
var contacts = new Array();

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
	if(isAuthenticated) {
		client.auth.getCurrentUserProfile().then(setCurrentUser);
	}
	else {
		document.getElementById("loading-label").style.display = "none";
		document.getElementById("meeting-button").style.display = "none";
		document.getElementById("login-button").style.display = "block";
		currentUser = null;
		contacts = new Array();
	}
}

function setCurrentUser(profile) {
	currentUser = profile;
	getIssue();
}

async function addContact(email) {
	const profile = await client.contact.addContact(email);
	contacts.push(profile.profileId);
}


function startMeeting() {
	if(contacts.length > 0) {
		client.meetings.startGroupMeeting(contacts);
	}
	else {
		alert("No one to meet with regarding this issue!");
	}
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
				var reporter = response.issues[0].fields.reporter;
				if(reporter.emailAddress != currentUser.primaryEmail) {
					await addContact(reporter.emailAddress);
					document.getElementById("meeting-button").style.display = "block";
				}
				else {
					document.getElementById("nochat-label").style.display = "block";
				}
				document.getElementById("login-button").style.display = "none";
				document.getElementById("loading-label").style.display = "none";
			},
			error: function() {
				console.log(arguments);
			}    
		});
	});
}
