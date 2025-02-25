'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)({ cache: false });
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    //io.sockets.in(room).emit('log', array);
    console.debug('log', array);
    //socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    io.sockets.in(message.room).emit('message', message);
    //socket.broadcast.emit('message', message);
  });

  socket.on('chat_message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    io.sockets.in(message.room).emit('chat_message', message);
    //socket.broadcast.emit('chat_message', message);
  });

  socket.on('create or join', function(message) {
    const room = message.room;
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;

    console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      io.sockets.in(room).emit('created', socket.id);
      //socket.emit('created', room, socket.id);
    } else if (numClients < 50) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      io.sockets.in(room).emit('joined', socket.id);
      //socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      io.sockets.in(room).emit('full', room);
      //socket.emit('full', room);
    }
  });

  // socket.on('ipaddr', function() {
  //   var ifaces = os.networkInterfaces();
  //   for (var dev in ifaces) {
  //     ifaces[dev].forEach(function(details) {
  //       if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
  //         socket.emit('ipaddr', details.address);
  //       }
  //     });
  //   }
  // });

});