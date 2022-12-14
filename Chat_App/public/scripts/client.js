
"use strict";


// variables which hold the data for each person
var socket = io(), 
	lstUsers = null,
	lstChannels = null,
	currentChannelName = "",
	channelMessages = {},
	channels = null,
	state = ["offline", "online"], // 0: offline, 1: online
	keys = getCipherKeys();
	

// on connection to server get the id of person's channel
socket.on("connect", () => {
	console.log(`connected by socket.id: ${socket.id}`)
	setConnectionStatus("connected");
	var me = getMe();
	if (me && localStorage.hashedPass) {
		// nonce password
		me.password = getNoncePassword(localStorage.hashedPass);
		socket.emit('login', me);		
	}
});

// quando expira o tempo da minha entrada no servidor
socket.on("resign", () => {
	var me = getMe();
	$(".login100-form-title").html("Login");
	$("#yourName").val(me.username);
	$("#yourEmail").val(me.email);
	$("#yourAvatar").attr("src=img/person.png");	
});

// quando me desligo do servidor e depois mudo o meu estado de perfil para offline
socket.on("disconnect", () => {
	console.warn(`socket <${getMe().socketid}> disconnected!`);
	setConnectionStatus("disconnected");
});

// on exception occurred from server call
socket.on("exception", err => {
	alert(err);
});

// guardar os dados do utilizador com sucesso no servidor
socket.on('signed', signedin);
	
// atualizar os dados dos utilizadores e os channels quando o seu estado muda
socket.on('update', data => {
	lstUsers = data.users;
	lstChannels = data.channels;
	$("#userContacts").empty();
	$("#channelContacts").empty();

	delete lstUsers[getMe().id];
	for (var prop in lstUsers) {
		var user = lstUsers[prop];
		var channel = getChannelName(user.id);
		$("#userContacts").append("<li id='" + channel + "' class='contact'>" + getUserLink(user, channel) + "</li>");
	}

	for (var prop in lstChannels) {
		var channel = lstChannels[prop];
		$("#channelContacts").append("<li id='" + channel.name + "' class='contact'>" + getChannelLink(channel) + "</li>")
	};

	if (currentChannelName != null && currentChannelName.length > 0) {
		chatStarted(currentChannelName);
	}
});

// quando um client se desconecta ou um administrador do channel está offline
socket.on('leave', leftedUser => {
	var u = lstUsers[leftedUser.id];
	if (u != null) {
		u.status = leftedUser.status;
		var chat = getChannelName(u.id);
		$(`#${getChannelName(u.id)}`).html(getUserLink(u, chat))
	}
});

// pedido dos utilizadores para conversar e para entrar no grupo 
socket.on('request', data => {
	var reqUser = lstUsers[data.from];
	if (reqUser == null) {
		socket.emit("reject", { to: data.from, channel: data.channel, msg: "I don't know who requested!" });
		return;
	}
	var reqChannel = getChannels()[data.channel];

	if (reqChannel == null) {  // dose not exist in channel list, so it's a new p2p channel!
		// ask me to accept or reject user request	
		
		if (confirm(`Pretende que o utilizador  <${reqUser.username}> possa falar consigo?`) == false) {
			socket.emit("reject", { to: data.from, channel: data.channel });
			return;
		}
		//aceitou
		createChannel(data.channel, true);
		reqChannel = getChannels()[data.channel];	
	}
	else if (reqChannel.p2p === false) {
		// ask me to accept or reject user request
		if (confirm(`Pretende que o utilizador <${reqUser.username}> entre no grupo: <${reqChannel.name}>?`) == false) {
			socket.emit("reject", { to: data.from, channel: data.channel });
			return;
		}
	}
	// encriptar o chat usando a chave publica que solicitamos do utilizador
	var encryptedChannelKey = reqChannel.channelKey.asymEncrypt(data.pubKey)
	// send data to requester user to join in current channel
	socket.emit("accept", { to: data.from, channelKey: encryptedChannelKey, channel: reqChannel.name })
	chatStarted(reqChannel.name);
	console.log("Chave publica do utilizador que pediu:"+data.pubKey);
});

// when my chat request accepted by channel admin
socket.on('accept', data => {
	// decrypt RSA cipher by my pricate key
	swal("", "O seu pedido foi aceite!", "success");
	var symmetricKey = data.channelKey.asymDecrypt(keys.privateKey);
	
	// store this channel to my channels list
	setChannel(data.channel, { name: data.channel, p2p: data.p2p, channelKey: symmetricKey });
	chatStarted(data.channel);	
	
});

// pedidos rejeitados pelo admin, tanto para iniciar um chat como entrar no grupo criado por ele
socket.on('reject', data => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : "because " + data.msg;
	if (data.p2p)
		swal("Erro!", `${admin.username} recusou o pedido para conversares com ele !!${reason}`, "error")
		
	else
		swal("Erro!", `${admin.username} recusou o pedido para entrares no grupo: ${data.channel}!! ${reason}`, "error")
	$(`#${data.channel}`).find(".wait").css("display", "none");
});

// when a messsage sent to me or channel which is I member in
socket.on('receive', data => {
	if (currentChannelName == data.to)  // from current channel name
		appendMessage(data);
	else {
		// keep in buffer for other time view
		data.state = "replies";
		//
		// increase badge
		var badge = $(`#${data.to}`).find(".badge");
		var badgeVal = badge.attr("data-badge");
		if (badgeVal == "") badgeVal = 0;
		badge.attr("data-badge", parseInt(badgeVal) + 1);
	}

	getMessages(data.to).push(data);
});

// when get response of my requests to fetch history of the chat messages
socket.on('fetch-messages', data => {
	if (data.messages == null)
		data.messages == []; // set to un-null to except next time requests
	channelMessages[data.channel] = data.messages;
	updateMessages();
});

socket.on('error', () => {
	console.log("Client: error");
	socket.socket.reconnect();
});

function reqChatBy(name) {
	$(`#${name}`).find(".wait").css("display", "block");
	var channel = getChannels()[name];

	if (channel && channel.channelKey) { // me already joined in chat
		chatStarted(name);
	}
	else {
		socket.emit("request", { channel: name, pubKey: keys.publicKey });
	}
}

function getUserLink(user, channel) {
	return `<div class='wrap' onclick='reqChatBy("${channel}")'>
				<span class='contact-status ${user.status}'></span>
				<img src='img/person.png' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name badge' data-badge=''>${user.username}</p>
				</div>
			</div>`;
}

function getChannelLink(channel) {
	return `<div class='wrap' onclick='reqChatBy("${channel.name}")'>				
				<img src='img/groups.jpg' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name badge' data-badge=''>${channel.name}</p>
				</div>
			</div>`;
}

function getChannelName(userid) {
	var ids = [getMe().id, userid].sort();
	return `${ids[0]}_${ids[1]}`; // unique name for this users private 
}

// set channels thread safe
function setChannel(name, channel) {
	getChannels()[name] = channel;
	localStorage.channels = JSON.stringify(getChannels());
}

function getChannels() {
	if (channels)
		return channels;

	if (localStorage.channels)
		channels = JSON.parse(localStorage.channels)
	else {
		channels = {};
		localStorage.channels = "{}"; // store string of object
	}

	return channels;
}

function setMe(data) {
	var lastMe = getMe();

	if (lastMe && lastMe.serverVersion !== data.serverVersion) {
		// server restarted, so refresh cached data
		localStorage.channels = "{}";
	}
	localStorage.me = JSON.stringify(data);
}

function getMe() {
	var me = localStorage.me;
	if (me == null)
		return null;
		//console.log("informação de cada utilizador :"+me);
	return JSON.parse(me);
	
}

function setConnectionStatus(state) {
	$("#profile-img").removeClass();

	if (state === "connected") {
		$("#profile-img").addClass('online');
	}
	else if (state === "disconnected") {
		$("#profile-img").addClass('offline');
	}
}

function chatStarted(channel) {
	currentChannelName = channel;
	$("li").removeClass("active");
	var contact = $(`#${channel}`);
	contact.addClass("active");
	contact.find(".badge").attr("data-badge", ""); // remove badge
	$("#channel-profile-img").attr("src", contact.find("img").attr("src"))
	$("#channel-profile-name").html(contact.find(".name").html())
	contact.find(".wait").css("display", "none");

	updateMessages();
}

function signedin(me) {
	setMe(me);
	$("title").html(`Secure Chat - ${me.username}`)
	$("#profile-img").attr("src=img/person.png");
	$("#myUsername").html(me.username);
	$("#myEmail").val(me.email);
	$(".main").remove();
	$("#frame").css("display", "block");
}

function updateMessages() {
	// show old messages
	var messages = getMessages(currentChannelName);

	// add all messages to screen
	var lstMessagesDom = $('.messages ul');
	lstMessagesDom.empty(); // clear screen
	for (var i in messages) {
		appendMessage(messages[i]);
	}
}

function newMessage() {
	var message = $(".message-input input").val();
	if ($.trim(message) == '') {
		return false;
	}

	if (currentChannelName == null || currentChannelName == '') {
		swal("Erro!", "Selecione alguém primeiro para falar!! ", "error")
		//alert("Please first select a chat to sending message!");
		return false;
	}

	// get channel symmetric key and encrypt message
	var chatSymmetricKey = getChannels()[currentChannelName].channelKey;
	var msg = message.symEncrypt(chatSymmetricKey)
	//console.log("Chave simetrica:"+ chatSymmetricKey);
	console.log("Mensagem encriptada:" +msg);

	// Send the message to the chat channel
	socket.emit('msg', { msg: msg, from: getMe().id, to: currentChannelName });

	// Empty the message input
	$('.message-input input').val(null);
	$('.message-input input').focus();
};

function appendMessage(data) {
	if (data.from == getMe().id) {
		data.state = "sent";
		data.name = getMe().username;
	} else {
		data.state = "replies"
		data.name = lstUsers[data.from].username;
	}

	data.msgHeader = "";
	if (lstChannels[data.to]) { // if is a real channel
		data.msgHeader = `<b>${data.name}</b><br />`
	}

	// get this channel symmetric key to decrypt message
	var symmetricKey = getChannels()[currentChannelName].channelKey;
	var msg = data.msg.symDecrypt(symmetricKey)
	console.log("Mensagem desencriptada:"+ msg);

	// add to self screen
	var messagesScreen = $(".messages");
	messagesScreen.find("ul").append(`<li class="${data.state}"><img src="img/person.png" title="${data.name}" /><p>${data.msgHeader}${msg}</p></li>`); // append message to end of page
	messagesScreen.scrollTop(messagesScreen[0].scrollHeight); // scroll to end of messages page
}

function getMessages(channel) {
	var msgArray = channelMessages[channel];
	if (msgArray == null) {
		// fetch from server
		socket.emit("fetch-messages", channel);
		return [];
	}
	else
		return msgArray;
}

function createChannel(channel, p2p) {
	if (lstChannels[channel])
		return false;

	// my socket is admin for this channel
	// generate symmetric key 
	var symmetricKey = generateKey(50);
	//
	// store this channel to my channels list
	setChannel(channel, { name: channel, p2p: p2p, channelKey: symmetricKey });

	return true;
}

// create nonce password by socket.id
function getNoncePassword(pass) {
	return pass.symEncrypt(socket.id);
}

(function ($) {
	"use strict";

	/*[ Press Enter to send message ]*/
	$('.submit').click(function () {
		newMessage();
	});

	$(window).on('keydown', function (e) {
		// notify user is typing...
		if (e.which == 13) {
			newMessage();
		}
	});

	/*[ Press Enter to login ]*/
	$(".validate-input").on('keydown', function (e) {
		if (e.which == 13) {
			$("#loginButton").click();
		}
	});
	
	/*[ Add channel button ]*/
	$("#addchannel").on("click", () => {
		var name = prompt("Por favor dê um nome ao grupo:", "Grupo");
		if (name) {
			if (createChannel(name, false)) {
				// send data to requester user to join in current channel
				socket.emit("createChannel", name);
			}
			else {
				swal("Erro!", "Já existe um grupo com esse nome ", "error")
			}
		}
	})
	/*[ Validate ]*/
	var input = $('.validate-input .input100');

	// Submit login div 
	$("#loginButton").on('click', () => {
		// validation data
		var check = true;
		for (var i = 0; i < input.length; i++) {
			if (validate(input[i]) == false) {
				showValidate(input[i]);
				check = false;
			}
		}

		if (check) { // if login data is valid then:
			var name = $.trim($("#yourName").val());
			var email = $("#yourEmail").val();
			var pass = $("#yourPass").val();
			localStorage.hashedPass = pass.getHash(); // store my login password by hashing
			var noncePass = getNoncePassword(localStorage.hashedPass);
			socket.emit('login', { username: name, email: email, password: noncePass });
		}
	});

	$('.validate-form .input100').each(function () {
		$(this).focus(function () {
			hideValidate(this);
		});
	});

	function validate(input) {
		if ($(input).attr('type') == 'email' || $(input).attr('name') == 'email') {
			if ($(input).val().trim().match(/^([a-zA-Z0-9_\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{1,5}|[0-9]{1,3})(\]?)$/) == null) {
				return false;
			}
		}
		else {
			if ($(input).val().trim() == '') {
				return false;
			}
		}
	}

	function showValidate(input) {
		var thisAlert = $(input).parent();

		$(thisAlert).addClass('alert-validate');
	}

	function hideValidate(input) {
		var thisAlert = $(input).parent();

		$(thisAlert).removeClass('alert-validate');
	}

})(jQuery);
