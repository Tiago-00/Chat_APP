//const io = require('socket.io')(3000)


const express = require("express");
const path = require("path");

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
app.use(express.static(path.join(__dirname+"/public")));


const users = {}

io.on('connection', socket => {
  socket.on('new-user', name => {
    users[socket.id] = name
    socket.broadcast.emit('user-connected', name)
    
  socket.on('send-chat-message', message => {
    socket.broadcast.emit('chat-message', { message: message, name: users[socket.id] })
    console.log("Nome da pessoa que enviou:" +name);
    console.log( "Mensagem:"+ message);

  })
})
  socket.on('disconnect', () => {
    socket.broadcast.emit('user-disconnected', users[socket.id])
    delete users[socket.id]
  })
})

server.listen(3000);