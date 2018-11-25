const client = new ChimeWebSDK();
const chatApi = client.chat;
const contactApi = client.contact;
const authApi = client.auth;

let conversationId;
const nameMap = {};
let currentProfile = {};
var jiraContacts;

function start() {
    // Always check if the user is authenticated on page load to
    // to detemine what to render
    authApi.checkIsAuthenticated()
        .then(function(isAuthenticated) {
            if (isAuthenticated) {
                authApi.getCurrentUserProfile()
                    .then(function(profile) {
                        currentProfile = profile;
						getJiraUsers();
                    })
            } else {
                showUnauthPage()
            }
        });

    // Render proper contents on auth change from other tabs
    authApi.onAuthStatus(function(isAuthenticated) {
        if (isAuthenticated) {
            showAuthPage();
        } else {
            showUnauthPage();
        }
    })

    $("#auth-button").click(login);
    $("#unauth-button").click(function() {
        authApi.signOut();
    });
};

function login() {
	authApi.checkIsAuthenticated().then(function(isAuthenticated) {
		if(!isAuthenticated) {
			authApi.authenticate();
		}
		else {
			showAuthPage();
		}
	});
}

// Append message to chat message wall
function appendMessage(content, senderId) {
    if (!content) return;
    const senderName = nameMap[senderId];
	const issueButton = document.createElement('button');
	issueButton.onclick = function() {
		createIssue(content);
	}
	issueButton.innerHTML = 'Create Issue';
	issueButton.classList.add('btn');
	issueButton.classList.add('btn-primary');
	issueButton.classList.add('float-right');
	const msgItem = document.createElement('li');
	msgItem.classList.add('list-group-item');
	msgItem.innerHTML = '<b>' + senderName + '</b>' + ': ' + content;
	msgItem.appendChild(issueButton);
    //$("#chat-messages").append('<li class="list-group-item">' + '<b>' + senderName + '</b>' + ': ' + content + '</li>', issueButton);
	$("#chat-messages").append(msgItem);
	$("#message-list").scrollTop($("#message-list")[0].scrollHeight);
}

// Append image to chat message wall
function appendImage(url) {
    $("#chat-messages").append('<li class="list-group-item"><img src="' + url + '" alt="image"></li>');
}

function appendError(target, error) {
    target.append('<div class="alert alert-danger">' + error + '</div>');
}

function renderItem(ref) {
    $(ref).removeClass("hidden");
}

function hideItem(ref) {
    $(ref).addClass("hidden");
}

// Hide other views and render login view
function handleLoginTabClick() {
    hideItem(".view");
    renderItem("#login-view");
}

// Hide other views and render login view
function handleSignoutTabClick() {
    hideItem(".view");
    renderItem("#signout-view");
}

// Hide other views and render contact view
function handleContactTabClick() {
    hideItem(".view");
    renderItem("#contact-view");
}

// 1. list conversation messages and append to page content
// 2. register onConversationMessage callback to receive new messages and append them to the view
// 3. Hide other views and render chat view
function handleChatTabClick() {
    chatApi.listConversationMessages(conversationId)
        .then(function(res) {
            $("#chat-messages").empty();
            for (let i = res.result.length - 1; i >= 0 ; i--) {
                const content = res.result[i].content;
                if (content) {
                    appendMessage(content, res.result[i].sender);
                }
                
                const url = res.result[i].attachmentVariants && res.result[i].attachmentVariants[0].url;
                if (url) {
                    appendImage(url)
                }
            }
        });
    chatApi.onConversationMessage(conversationId, function(event) {
        const content = event.data.record.content;
        if (content) {
            appendMessage(content, event.data.record.sender);
        } 
    });
    hideItem(".view");
    renderItem("#chat-view");
}

// Add contact and create conversation, and save conversation id
// to global variable conversationId
function handleAddContact() {
	var contactSelect = document.getElementById("contact-select");
	if(contactSelect.selectedIndex != 0) {
		const email = contactSelect.value;
		contactApi.addContact(email)
			.then(function(res) {
				chatApi.createConversation([res.profileId])
					.then(function(res) {
						conversationId = res.id;
						const members = res.members;
						for (const member of members) {
							nameMap[member.id] = member.name;
						} 
						const chatName = members[0].id === currentProfile.profileId ? members[1].name : members[0].name;
						$('#chat-name').empty();
						$('#chat-name').append('Chat with: ' + chatName);
						renderItem("#chat-tab");
					})
					.catch(function(error) {
						appendError($('#contact-error'), error);
					})
			});
	}
	else {
		alert("Please select a contact first!");
	}
}

function handleSendMessage() {
    const message = $("#message-input").val();
    if (message.trim()) {
        chatApi.createConversationMessage(conversationId, message.trim())
            .then(function(res) {
                $("#message-input").val('');
            })
    }
}

// Render a page that is authenticated
function showAuthPage() {
    renderItem(".auth-item");
    hideItem(".unauth-item");
    hideItem(".view");
}

// Render a page that is unauthenticated
function showUnauthPage() {
    renderItem(".unauth-item");
    hideItem(".auth-item");
    hideItem(".view");
    hideItem("#chat-tab");
}

function getJiraUsers() {
	var urlParams = new URLSearchParams(window.location.search);
	var projectKey = urlParams.get("projectKey");
	AP.require('request', function(request) {
		request({
			url: '/rest/api/latest/user/assignable/multiProjectSearch?projectKeys=' + projectKey,
			success: async function(response) {
				// convert the string response to JSON
				response = JSON.parse(response);
				var responseText = JSON.stringify(response);
				console.log(responseText);
				var contactSelect = document.getElementById("contact-select");
				while(contactSelect.options.length > 1) {
					contactSelect.remove(contactSelect.options.length - 1);
				}
				jiraContacts = new Array();
				for(var i = 0; i < response.length; i++) {
					if(response[i].emailAddress != currentProfile.primaryEmail) {
						var contactOption = document.createElement("option");
						contactOption.text = response[i].displayName;
						contactOption.value = response[i].emailAddress;
						contactSelect.add(contactOption);
						jiraContacts.push(response[i].name)
					}
				}
				showAuthPage();
			},
			error: function() {
				console.log(arguments);
			}    
		});
	});
}

function createIssue(newIssue) {
	var issueFields = newIssue.split(':');
	var urlParams = new URLSearchParams(window.location.search);
	var projectId = urlParams.get("projectId");
	var issueData = {
	  "fields": {
		"project": { 
		  "id": projectId
		},
		"summary": issueFields[0],
		"description": (issueFields.length == 1)? "Added using chime chat" : issueFields[1],
		"issuetype": {
		  "name": "Task"
		},
		"assignee":{
			"name": jiraContacts[document.getElementById("contact-select").selectedIndex - 1]
		}
	  }
	};
	AP.require('request', function(request) {
	  request({
		url: '/rest/api/latest/issue',
		// adjust to a POST instead of a GET
		headers: {
			"X-Atlassian-Token": "no-check"
		},
		type: 'POST',
		data: JSON.stringify(issueData),
		contentType: 'multipart/form-data',
		success: function(response) {
		  // convert the string response to JSON
		  response = JSON.parse(response);
		  alert("Issue was successfully added, key: " + response.key);
		  // dump out the response to the console
		  console.log(response);
		},
		error: function() {
		  console.log(arguments);
		},
		// inform the server what type of data is in the body of the HTTP POST
		contentType: "application/json"    
	  });
	});
}

start();