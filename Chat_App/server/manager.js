var e = {}
module.exports = e;

e.clients = {}; // property: id, value: { socketid, id, username, email, pubKey, password, status }
e.messages = {}; // property: channelName, value { from, to, date, type }
e.grupos = {}; // property: channelName, value: { name, p2p, adminUserId, users[] }

// generate 16 char length
e.generateGuid = function () {
    return Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);
}

e.getHashCode = String.prototype.hashCode = function () {
    var hash = 0, i, chr;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(32); // to base 32
}

e.getUsers = function () {
    var users = {};
    for (prop in e.clients) {
        var u = e.clients[prop];
        users[prop] = {
            id: u.id,
            email: u.email,
            username: u.username,
            status: u.status
        };
    }
    return users;
}

e.getUsergrupos = function (userId, byP2p = false) {
    var usergrupos = {};
    if (userId) {
        for (prop in e.grupos) {
            var r = e.grupos[prop];
            if (r.users.indexOf(userId) !== -1) {
                if ((byP2p === false && r.p2p === false) || byP2p === true)
                    usergrupos[prop] = r;
            }
        }
    }
    return usergrupos;
}

e.getgrupos = function () {
    var listaGrupos = {};
    for (prop in e.grupos) {
        var r = e.grupos[prop];
        if (r.p2p === false) {
            listaGrupos[prop] = r;
        }
    }
    return listaGrupos;
}

e.EncontrarUtilizador = function (socketid) {
    for (prop in e.clients) {
        var u = e.clients[prop];
        if (u.socketid === socketid) {
            return u;
        }
    }
    return null; // user not found
}

//junçao dos id dos utilizadores quando pretendem falar os dois 
e.generateChannelName = function (uid0, uid1) {
    var ids = [uid0, uid1].sort();
    return ids[0] + "_" + ids[1]; 
}

e.getAdminFromChannelName = function (channelName, userid) {
    var admin = null;

    // find channel to send client request
    var channel = e.grupos[channelName];

    if (channel == null) { // requested to new p2p channel
        var halfIndex = channelName.indexOf("_");
        if (halfIndex < 1)
            return null; // p2p channel name incorrect

        var u0 = channelName.substring(0, halfIndex);
        var u1 = channelName.substring(halfIndex + 1);

        admin = (u0 === userid)
            ? e.clients[u1] 
            : admin = e.clients[u0];
    }
    else
        admin = e.clients[channel.adminUserId];

    return admin;
}