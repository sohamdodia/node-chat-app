const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');

const {generateMessage,generateLocationMessage} = require('./utils/message');
const {isRealString} = require('./utils/validation');
const {Users} = require('./utils/users');

const publicPath = path.join(__dirname,'../public');
const port = process.env.PORT || 3000;
var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var users = new Users();

app.use(express.static(publicPath));

//On new connection
io.on('connection',(socket) => {


	socket.on('join', (params, callback) => {
		//Check Weather the input data is correct or not
		if(!isRealString(params.name) || !isRealString(params.room)) {
			return callback('Name and room name is required');
		}

		socket.join(params.room);
		users.removeUser(socket.id);
		users.addUser(socket.id,params.name,params.room);

		//Update the list of users in the current room.
		io.to(params.room).emit('updateUserList',users.getUserList(params.room));

		//from admin to the user 
		socket.emit('newMessage',generateMessage('Admin','Welcome to the chat app'));

		//socket.broadcast.emit from admin to the other users within the same room.
		socket.broadcast.to(params.room).emit('newMessage',generateMessage('Admin',`${params.name} has joined.`));
		callback();
	});

	//when user send message send it to all the user including the user who send the message in same room.
	socket.on('createMessage',function(message,callback){
		var user = users.getUser(socket.id);

		if(user && isRealString(message.text)) {
			io.to(user.room).emit('newMessage',generateMessage(user.name,message.text));
		}
		callback();
	});

	//Send user's current location to all users in the same room
	socket.on('createLocationMessage',(coords) => {
		var user = users.getUser(socket.id);
		if(user) {
			io.to(user.room).emit('newLocationMessage',generateLocationMessage(user.name,coords.latitude,coords.longitude ));
		}
	});

	socket.on('disconnect',() => {
		var user = users.removeUser(socket.id);
		
		//update the user's list when user left the room.	
		if(user) {
			io.to(user.room).emit('updateUserList',users.getUserList(user.room));
			io.to(user.room).emit('newMessage',generateMessage('Admin',`${user.name} has left.`));
		}
	});
});


//Server Starting
server.listen(port,() => {
	console.log(`Server is up on port ${port}`);
});