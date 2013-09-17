var fs = require('fs');  // File system access
var express = require('express');  // Express framework
var hogan = require('hogan.js');  // Library for Mustache templates
var moment = require('moment');

// App configuration
if (!fs.existsSync('config.js')) {
	console.error('Config file [config.js] missing!');
	console.error('Either rename sample-config.js and populate with your settings, or run "make decrypt_conf".');
	process.exit(1);
}

var twitter = require('./controllers/twitter');
var user = require('./controllers/user');
var c = require('./config').config;  // App configuration

var app = express();
app.use(express.cookieParser());
app.use(express.session({secret: 'foo'}));
app.use(express.bodyParser());

var server = require('http').createServer(app),
	io = require('socket.io').listen(server, { resource: '/stream/socket.io' });
		
server.listen(c.port);
console.log('\nServer running on port ' + c.port + '.');
console.log('Try this: http://localhost:' + c.port + '/stream\n');

// Define paths for serving up static content. 
app.use('/stream/css', express.static(__dirname + '/css'));
app.use('/stream/js', express.static(__dirname + '/js'));
app.use('/stream/img', express.static(__dirname + '/img'));
app.use('/stream/socket.io', express.static(__dirname + '/socket.io'));

// Default (root) URL handler
app.get('/stream', function (req, res) { 
	var templateData = { user: null, isAuthorized: false, isSuperUser : false };  // Object merged with the mustache template. 
	
	// Load the default template
	fs.readFile('./views/default.ms', 'utf8', function (err, msTemplate) {
	    if (err) { 
		   	console.log('Encountered error reading template.'); 
		   	res.end(JSON.stringify(err));
		} else {	
			// Load the "project details" template
			var detailsTemplate = fs.readFileSync('./views/projectDetails.ms', 'utf8');
			detailsTemplate = hogan.compile(detailsTemplate.toString());

			// Init partial objects.
			var partial = {};
			partial.projectDetails = detailsTemplate;
			
			var template = hogan.compile(msTemplate.toString());  // Compile the Mustache template.

			user.getUser(req.cookies.userid, function(err, currUser) { 
				if (!err) { 
					templateData.user = currUser;							
					// Determine if the user has authorized at least one supported service
					if (currUser && currUser.services) {
						templateData.isAuthorized = (currUser.services.twitter) ? true : false;
						if (templateData.isAuthorized)
							templateData.isSuperUser = isSuperUser(currUser.services.twitter.username);
					}
					
					var output = template.render(templateData, partial);  // Transform the template with data. 
					res.end(output);
					
				} else {
					res.end(JSON.stringify(err));
				}
			});
		}
	});
});

app.get('/stream/templates', function (req, res) {
	fs.readFile('./views/templates.djs', 'utf8', function (err, msTemplate) {
	    if (err) { 
		   	console.log('Encountered error reading template.');
		   	res.end('Encountered error reading template. ' + JSON.stringify(err));
		} else {
			res.contentType('text/html');
			res.end(msTemplate);
		}
	});
});


// Define socket(s)
io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
// io.enable('browser client gzip');  // gzip the file
io.set('log level', 1);  // Set the log level (0-3); 
io.set('transports', [
	'websocket'
	, 'flashsocket'
	, 'htmlfile'
	, 'xhr-polling'
	, 'jsonp-polling'
]);


io.sockets.on('connection', function(socket) {
	socket.emit('msg', { messages: [ { type: 'info', msg: 'Connection established.' }] });
	
	// The 'control' handler controls the start and stop of the twitter stream. 
	socket.on('control', function(data) {
		
		// No action is taken without a valid userid
		if (c.debugUser) { data.userid = c.debugUser; }
		
		if (data.userid || (c.twitter.userToken && c.twitter.userTokenSecret)) {  // Look for a userid (cookie from shoe.io/auth) or a user token/secret in the config. 
			// Determine what action to take.
			if (data.action.toLowerCase() == 'start') {  // New stream. 

				user.getUser(data.userid, function(err, currUser) {
					if (!err) {

						var msg = '';
						if (data.searchTerm && data.searchTerm.length > 0) msg = 'Creating new search stream for \'' + data.searchTerm + '\'.';
						else msg = 'Creating new user stream for @' + currUser.services.twitter.username + '.'
						socket.emit('msg', { messages: [ { 'type': 'info', 'msg': msg } ] });
						socket.broadcast.emit('msg', { messages: [ { 'type': 'info', 'msg': msg } ] });
						
						// Some users are considered 'super users' and can access the public API stream, which is limited to one connection per IP address.
						// Everyone else has to use the simple Twitter user stream.
						// Figure out which rule applies here. 
						var streamType = (isSuperUser(currUser.services.twitter.username) && (data.searchTerm || data.mapBounds)) ? 'public' : 'user';
						var newStream = new twitter.Stream(currUser.services.twitter, streamType);
						newStream.subscribe(function(tweet) {  // Subscribe (observe) the stream. Function to handle each tweet. 
							socket.emit('tweet', tweet);
						});
				
						// Fire up the stream. 
						newStream.start(data.searchTerm, data.mapBounds, function(err) {
							if (!err) {
								socket.set('stream', newStream, function() {  // Save this stream for later. 
									socket.emit('ready');
								});
							}
						});
					} else {
						socket.emit('msg', { messages: [ { 'type': 'error', 'msg': err } ] });
					}
				});
			} else if (data.action.toLowerCase() == 'stop') {  // Request to stop an existing stream. 
				stopStream(socket);
			}
		} else {
			socket.emit('msg', { messages: [ { type: 'error', msg: 'No user id could be found. Please take a look at the app configuration.' } ] });
		}
	});
	
	// The 'heartbeat' handler is used by the client to provide some assurance we're still connected. 
	socket.on('heartbeat', function(data) {
		var msg = '';
		if (data.searchTerm)
			msg += ' Searching for \'' + data.searchTerm + '\'.';
		else
			msg += ' Heartbeat received.';
		socket.emit('msg', { messages: [ { 'type' : 'info', 'date' : new Date(), 'msg': msg } ] });
	});
	
	// Handler when the client disconnects. 
	socket.on('disconnect', function() {
		stopStream(socket);
		io.sockets.emit('User ' + socket.id + ' disconnected.');
    });
});


// Shared function to stop a stream. 
function stopStream(socket) {
	socket.emit('msg', { messages: [ { type: 'info', msg: 'Stopping stream.' }] });
	
	socket.get('stream', function (err, stream) {  // Retrieve the existing stream for this client. 
		try {  // Sometimes the client will attempt to stop a request that has already been aborted. 
			stream.request.abort();  // Kill the request. 
		} catch(ex) { }
		finally {
			socket.emit('ready');			      
		}
	});
}

// Determine if the provided username is among the list of super users
// See notes on Twitter's ToS for details why we need to do this.
// "super users" are defined in config.js
// If a userToken and userTokenSecret is defined, default to superuser. 
function isSuperUser(username) {
	if (c.twitter.userToken && c.twitter.userTokenSecret) return true;
	else if (c.superUsers) {
		for (var ii=0; ii < c.superUsers.length; ii++) {
			if (c.superUsers[ii] == username) { return true; }
		}
	}
	return false;
}


// Add C#-ish string formatting to JavaScript. 
String.prototype.format = function() { 
	var args = arguments; 
	return this.replace(/{(\d+)}/g, function(match, number) { 
		return typeof args[number] != 'undefined' 
			? args[number] 
			: match
		;
	});
};

	
// Sanity check, make sure the encrypted config file is up to date. 
// http://ejohn.org/blog/keeping-passwords-in-source-control/
(function() {
	var conf_time = fs.statSync('config.js').mtime.getTime();
	var cast5_time = fs.statSync('config.js.cast5').mtime.getTime();
	
	if (conf_time < cast5_time) {
		console.log(conf_time + ' ' + cast5_time);
		console.error('Your config file is out of date!');
		console.error('You need to run "make decrypt_conf" to update it.');
		// process.exit(1);
	}
})();


