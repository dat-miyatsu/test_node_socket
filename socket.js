var express = require('express'),
	cluster = require('cluster'),
	sio = require('socket.io');

var port = 3001,
	num_processes = require('os').cpus().length;

if (cluster.isMaster) {
  console.log('Master server started on port ' + port);

	for (var i = 0; i < num_processes; i++) {
		cluster.fork();
	}
} else {
  console.log('- Child server started on port ' + port + ' case worker id=' + cluster.worker.id);
	var app = new express();

	// Here you might use middleware, attach routes, etc.

	var server = app.listen(port),
    io = sio(server);
    
    io.on('connection', function(socket) {
			console.log('Người dùng đã kết nối tới ứng dụng with worker: ' + cluster.worker.id);
			socket.on('disconnect', function() {
				console.log('Người dùng đã ngắt kết nối tới ứng dụng');
			});
		});

	// Here you might use Socket.IO middleware for authorization etc.
}
