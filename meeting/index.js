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
		//document.getElementById("currentUser").innerHTML = "";
		document.getElementById("meeting-button").style.display = "none";
		currentUser = null;
		contacts = new Array();
	}
}

function setCurrentUser(profile) {
	currentUser = profile;
	//document.getElementById("currentUser").innerHTML = currentUser.name;
	getIssue();
	document.getElementById("meeting-button").style.display = "block";
}

async function addContact(email) {
	const profile = await client.contact.addContact(email);
	contacts.push(profile.profileId);
}


function startMeeting() {
	if(contacts.length > 0)
		client.meetings.startGroupMeeting(contacts);
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
				if(reporter.emailAddress != currentUser.primaryEmail)
					await addContact(reporter.emailAddress);
				var assignee = response.issues[0].fields.assignee;
				if(assignee && assignee.emailAddress != reporter.emailAddress && assignee.emailAddress != currentUser.primaryEmail)
					await addContact(assignee.emailAddress);
			},
			error: function() {
				console.log(arguments);
			}    
		});
	});
}
