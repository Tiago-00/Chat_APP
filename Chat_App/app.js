var express = require('express');
var path = require('path');
app.set('port', (process.env.PORT || 3000));


const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'html');

// Initialize the ejs template engine
app.engine('html', require('ejs').renderFile);

// onde ira encontrar o template
app.set('views', path.join(__dirname, 'public/views'));

// sets up event listeners for the two main URL 
// endpoints of the application - /
app.get('/', function (req, res) {
	// Render views/chat.html
	res.render('chat');
});

require('./server/server')(app, io);
server.listen(port);
module.exports = app;

