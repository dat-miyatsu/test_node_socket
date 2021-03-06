var express = require('express'),
	cluster = require('cluster'),
	net = require('net'),
	sio = require('socket.io'),
	farmhash = require('farmhash');

var port = 3001,
	num_processes = require('os').cpus().length;

if (cluster.isMaster) {
  console.log('Master server started on port ' + port);

	// This stores our workers. We need to keep them to be able to reference
	// them based on source IP address. It's also useful for auto-restart,
	// for example.
	var workers = [];

	// Helper function for spawning worker at index 'i'.
	var spawn = function(i) {
		workers[i] = cluster.fork();

		// Optional: Restart worker on exit
		workers[i].on('exit', function(code, signal) {
			console.log('respawning worker', i);
			spawn(i);
		});
	};

	// Spawn workers.
	for (var i = 0; i < num_processes; i++) {
		spawn(i);
	}

	// Helper function for getting a worker index based on IP address.
	// This is a hot path so it should be really fast. The way it works
	// is by converting the IP address to a number by removing non numeric
	// characters, then compressing it to the number of slots we have.
	//
	// Compared against "real" hashing (from the sticky-session code) and
	// "real" IP number conversion, this function is on par in terms of
	// worker index distribution only much faster.
	var worker_index = function(ip, len) {
		return farmhash.fingerprint32(ip) % len; // Farmhash is the fastest and works with IPv6, too
	};

	// Create the outside facing server listening on our port.
	var server = net
		.createServer({ pauseOnConnect: true }, function(connection) {
			// We received a connection and need to pass it to the appropriate
			// worker. Get the worker for this connection's source IP and pass
      // it the connection.
      var clientIp = connection.headers['x-forwarded-for'] || connection.remoteAddress;
      var workerIndex = worker_index(connection.remoteAddress, num_processes);
      console.log('workerIndex', workerIndex, clientIp);
			var worker = workers[workerIndex];
			worker.send('sticky-session:connection', connection);
		})
		.listen(port);
} else {
  console.log('- Child server started on port ' + port + ' case worker id=' + cluster.worker.id);

	// Note we don't use a port here because the master listens on it for us.
	var app = new express();

	// Here you might use middleware, attach routes, etc.

	// Don't expose our internal server to the outside.
	var server = app.listen(0, 'localhost'),
		io = sio(server);
  
  io.on('connection', function(socket) {
    console.log('Người dùng đã kết nối tới ứng dụng with worker: ' + cluster.worker.id);
    console.log('headers====', JSON.stringify(socket.handshake.headers));
    // var clientIp = socket.request.connection.remoteAddress;
		// var address = socket.handshake.address;
    // console.log('New connection from ' + address + ' with IP: ' + clientIp);
    
		socket.on('disconnect', function() {
			console.log('Người dùng đã ngắt kết nối tới ứng dụng');
		});
  });
  
  app.get('/', function(request, response) {
		console.log('send message by worker: ' + cluster.worker.id);
		response.sendFile(__dirname + '/index.html');
	});

	// Here you might use Socket.IO middleware for authorization etc.

	// Listen to messages sent from the master. Ignore everything else.
	process.on('message', function(message, connection) {
		if (message !== 'sticky-session:connection') {
			return;
		}

		// Emulate a connection event on the server by emitting the
		// event with the connection the master sent us.
		server.emit('connection', connection);

		connection.resume();
	});
}
