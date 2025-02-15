"use strict";

var manager = require('./manager.js');
var crypto = require("crypto-js");
var serverVersion = manager.generateGuid();
var ChatGlobal = "environment"; // add any authenticated user to this channel
var chat = {}; // socket.io
var loginExpireTime = 3600 * 1000; // 3600sec


module.exports = function (app, io) {
    // Initialize a new socket.io application, named 'chat'
    chat = io;
    io.on('connection', function (socket) {
        console.info(`socket: ${socket.id} connected`);

        // When the client emits 'login', save his name,
        // and add them to the channel
        socket.on('login', data => {
            // check login password from decrypt cipher by nonce password (socket.id)
            var userHashedPass = crypto.AES.decrypt(data.password, socket.id).toString(crypto.enc.Utf8);

            var user = manager.clients[data.email.hashCode()];
            if (user) { // exist user                
                if (user.password == userHashedPass) {
                    // check user sign expiration
                    if (user.lastLoginDate + loginExpireTime > Date.now()) { // expire after 60min
                        userSigned(user, socket);
                    }
                    else {
                        socket.emit("resign");
                    }
                    user.lastLoginDate = Date.now(); // update user login time
                }
                else { 
                    socket.emit("exception", "The username or password is incorrect!");
                    console.info(`User <${user.username}> can't login, because that password is incorrect!`);
                }
            }
            else { // new user
                var user = {
                    "socketid": socket.id, 
                    "id": data.email.hashCode(),
                    "username": data.username, 
                    "email": data.email,                                      
                    "password": userHashedPass, 
                    "status": "online", 
                    "lastLoginDate": Date.now() 
                };               
                manager.clients[user.id] = user;
                userSigned(user, socket);
            }
        }); // login

    }); 

} 

function userSigned(user, socket) {
    user.status = "online";
    user.socketid = socket.id;
    socket.user = user;

    socket.emit("signed", {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "status": user.status,
        "serverVersion": serverVersion,
        "password": user.password,       
    });

    socket.join(ChatGlobal); // join all users in global authenticated group
    
    // add user to all joined grupos
    var usergrupos = manager.getUsergrupos(user.id, true); // by p2p channel
    for (var channel in usergrupos) {
        socket.join(channel);
    }

    AtualizarUtilizadores();
    defineSocketEvents(socket);

    console.info(`User <${user.username}> by socket <${user.socketid}> connected`)
} 

function AtualizarUtilizadores() {
    // tell new user added and list updated to everyone except the socket that starts it
    chat.sockets.in(ChatGlobal).emit("update", { users: manager.getUsers(), grupos: manager.getgrupos() });
}

function CriarGrupo(name, user, p2p) {
    var channel = { name: name, p2p: p2p, adminUserId: user.id, status: "online", users: [user.id] };
    manager.grupos[name] = channel;
    chat.sockets.connected[user.socketid].join(name); // add admin to self chat
    return channel;
}

function defineSocketEvents(socket) {

    // alguem saiu do chat
    socket.on('disconnect', () => {
        // procurar qual foi o utilizador
        var user = socket.user || manager.EncontrarUtilizador(socket.id);
        if (user) {
            console.warn(`User <${user.username}> by socket <${user.socketid}> disconnected!`);
            user.status = "offline";
            socket.broadcast.to(ChatGlobal).emit('leave',
                { username: user.username, id: user.id, status: user.status });
        }
    });

    socket.on("msg", data => {
        var from = socket.user || manager.EncontrarUtilizador(socket.id);
        var channel = manager.grupos[data.to];
        const hmacKey = data.hmacKey;
        var hmac = data.hmac;
        if (from != null && channel != null && channel.users.indexOf(from.id) != -1) {
            hmac = crypto.HmacSHA256(data.msg, hmacKey).toString();
           // hmac = "ola";
            console.log("hmac:"+hmac);
            if (hmac != data.hmac) {
                // HMACs do not match, discard the message
                console.log("ola");
                return ;
            }
            //console.log("w");
            var msg = manager.messages[channel.name];
            if (msg == null)
                msg = manager.messages[channel.name] = [];

            data.date = Date.now();
            data.type = "msg";

            // When the server receives a message, it sends it to the all clients
            chat.sockets.in(channel.name).emit('receive', data);
            msg.push(data);
        }
    });

    // Handle the request of users for chat
    socket.on("request", data => {

        // find user who requested to this chat by socket id
        var from = socket.user || manager.EncontrarUtilizador(socket.id);

        // if user authenticated 
        if (from) {
            data.from = from.id; // inject user id in data

            // find admin user who should be send request to
            var adminUser = manager.getAdminFromChannelName(data.channel, from.id)

            if (adminUser) {
                if (adminUser.status == "offline") {
                    var p2p = (manager.grupos[data.channel] == null ? true : manager.grupos[data.channel].p2p);
                    socket.emit("reject", { from: adminUser.id, channel: data.channel, p2p: p2p, msg: "admin user is offline" });
                }
                else
                    chat.to(adminUser.socketid).emit("request", data)
                return;
            }
        }
        // from or adminUser is null
        socket.emit("exception", "The requested chat not found!");
    });

    // Handle the request of users for chat
    socket.on("accept", data => {

        // find user who accepted to this chat by socket id
        var from = socket.user || manager.EncontrarUtilizador(socket.id);

        // find user who is target user by user id
        var to = manager.clients[data.to];

        // if users authenticated 
        if (from != null && to != null) {
            var channel = manager.grupos[data.channel];

            if (channel == null) {
                // new p2p channel
                channel = CriarGrupo(data.channel, from, true)
            }
            // adicionar utilizador ao channel
            channel.users.push(to.id);
            chat.sockets.connected[to.socketid].join(channel.name);

            // send accept msg to user which requested to chat
            socket.to(to.socketid).emit("accept", { from: from.id, channel: channel.name, p2p: channel.p2p, channelKey: data.channelKey })
        }
    });

    // Handle the request to create channel
    socket.on("CriarGrupo", name => {
        var from = socket.user;
        var channel = manager.grupos[name];

        if (channel) {
            
            socket.emit("reject", { from: from.id, p2p: false, channel: channel, msg: "O nome desse grupo ja existe" })
            return;
        }

        // criação do channel
        channel = CriarGrupo(name, from, false);
        AtualizarUtilizadores();

        console.info(`Channel <${channel.name}> created by user <${from.username}: ${channel.adminUserId}>`)
    });

    // Handle the request of users for chat
    socket.on("reject", data => {

        // find user who accepted to this chat by socket id
        var from = socket.user || manager.EncontrarUtilizador(socket.id);

        // find user who is target user by user id
        var to = manager.clients[data.to];

        // if users authenticated 
        if (from != null && to != null) {
            var channel = manager.grupos[data.channel];
            socket.to(to.socketid).emit("reject", { from: from.id, p2p: (channel == null), channel: data.channel })
        }
    });

    // Handle the request of users for chat
    socket.on("fetch-messages", channelName => {
        // find fetcher user
        var fetcher = socket.user || manager.EncontrarUtilizador(socket.id);

        var channel = manager.grupos[channelName];

        // check fetcher was a user of channel
        if (fetcher != null && channel != null && channel.users.indexOf(fetcher.id) !== -1)
            socket.emit("fetch-messages", { channel: channel.name, messages: manager.messages[channel.name] });
        else
            socket.emit("exception", `you are not joined in <${channelName}> channel or maybe the server was lost your data!!!`);
    });

    socket.on("typing", channelName => {
        var user = socket.user || manager.EncontrarUtilizador(socket.id);
        var channel = manager.grupos[channelName];

        if (user && channel && channel.users.indexOf(user.id) !== -1) {
            chat.sockets.in(channel.name).emit("typing", { channel: channel.name, user: user.id });
        }
    });

}