// on the server
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var socket = require('socket.io');
var io = socket(server);
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var port = 3001;
var sticky = require('sticky-session');

io.attach(server);

// socket.io
// io.set('store', new socket.RedisStore);

// set-up connections...
io.sockets.on('connection', function(socket) {
    socket.on('join', function(rooms) {
        rooms.forEach(function(room) {
            socket.join(room);
        });
    });

    socket.on('leave', function(rooms) {
        rooms.forEach(function(room) {
            socket.leave(room);
        });
    });

});

if (cluster.isMaster) {

  console.log('Master server started on port ' + port);
    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Emit a message every second
    // function send() {
    //     console.log('howdy');
    //     io.sockets.in('room').emit('data', 'howdy');
    // }

    // setInterval(send, 1000);


    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died');
    }); 
} else {
  console.log('- Child server started on port ' + port + ' case worker id=' + cluster.worker.id);

  	app.get('/', function(request, response) {
			console.log('send message by worker: ' + cluster.worker.id);
			response.sendFile(__dirname + '/index.html');
		});

		io.on('connection', function(socket) {
			console.log('Người dùng đã kết nối tới ứng dụng with worker: ' + cluster.worker.id);
			socket.on('disconnect', function() {
				console.log('Người dùng đã ngắt kết nối tới ứng dụng');
			});
		});

    // app.listen(port);
    sticky.listen(server, port);

}