var sticky = require('sticky-session-reverse-proxy'),
	http = require('http'),
	express = require('express'),
	socketIO = require('socket.io'),
	cluster = require('cluster'),
	port = process.env.PORT || 3002;
var numCPUs = require('os').cpus().length;

var app = express(),
	io;

server = http.Server(app);

io = socketIO(server);

// Add your socket.IO connection logic here

if (
	!sticky.listen(server, port, {
		workers: numCPUs,
		proxyHeader: 'x-forwarded-for', //header to read for IP
	})
) {
	server.once('listening', function() {
		console.log('Server started on port ' + port);
	});

	if (cluster.isMaster) {
		console.log('Master server started on port ' + port);
	}
} else {
	console.log('- Child server started on port ' + port + ' case worker id=' + cluster.worker.id);

	app.get('/', function(request, response) {
		console.log('send message by worker: ' + cluster.worker.id);
		response.sendFile(__dirname + '/index.html');
	});

	io.on('connection', function(socket) {
		console.log('Người dùng đã kết nối tới ứng dụng with worker: ' + cluster.worker.id);
		var clientIp = socket.request.connection.remoteAddress;
		var address = socket.handshake.address;
		console.log('New connection from ' + address + ' with IP: ' + clientIp);
		console.log('headers====', JSON.stringify(socket.handshake.headers));

		socket.on('disconnect', function() {
			console.log('Người dùng đã ngắt kết nối tới ứng dụng');
		});
	});
}
