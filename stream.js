var fs = require('fs');  
var path = require('path');
var http = require('http');
var express = require('express');  // Express framework
var bodyParser = require('body-parser');
var compress = require('compression');
var cookieParser = require('cookie-parser');
var hogan = require('hogan.js');  // Library for Mustache templates
var moment = require('moment');
var _ = require('lodash');

// App configuration
if (!fs.existsSync('config.js')) {
    console.error('Config file [config.js] missing!');
    console.error('Either rename sample-config.js and populate with your settings, or run "make decrypt_conf".');
    process.exit(1);
}

var twitter = require('./controllers/twitter');
var user = require('./controllers/user');
var c = require('./config').config;  // App configuration

// Init Express
var app = express();
app.set('port', c.portNum || 3000);
app.use(compress());
app.use(bodyParser.json());
app.use(cookieParser('foo'))

// Define paths for serving up static content. 
app.use('/stream/', express.static(path.join(__dirname, 'public')));  // Define path(s) for serving up static content. 

var server = require('http').Server(app),
    io = require('socket.io')(server, { serveClient: true, path: '/stream/socket.io'});


/**
 * Fire up the server. 
 */
server.listen(app.get('port'), function(){
    console.log('Server started on port ' + app.get('port') + '. \nTry this: http://localhost:' + app.get('port') + '/stream');
});

        
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
io.set('transports', ['websocket', 
                      'flashsocket', 
                      'htmlfile', 
                      'xhr-polling', 
                      'jsonp-polling', 
                      'polling']);

var newStream;  // Our stream to Twitter.

io.on('connection', function(socket) {
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
                        newStream = new twitter.Stream(currUser.services.twitter, streamType);
                        newStream.subscribe('tweet', function(tweet) {  // Subscribe (observe) the stream. Function to handle each tweet. 
                            socket.emit('tweet', tweet);
                        });

                        newStream.subscribe('message', function(msg) {
                            socket.emit('msg', { messages: [ { 'type': 'alert-info', 'msg': msg } ] });
                        });
                
                        // Fire up the stream. 
                        newStream.start(data.searchTerm, data.mapBounds, function(err) {
                            if (!err) {
                                socket.emit('ready');
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
    if (newStream && newStream.tweetStream) newStream.tweetStream.stop();  // Kill the request
}

// Determine if the provided username is among the list of super users
// See notes on Twitter's ToS for details why we need to do this.
// "super users" are defined in config.js
// If a userToken and userTokenSecret is defined, default to superuser. 
function isSuperUser(username) {
    if (c.twitter.userToken && c.twitter.userTokenSecret) return true;
    else if (c.superUsers && _.contains(c.superUsers, username)) return true;
    else return false;
}

    
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


