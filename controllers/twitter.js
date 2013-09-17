// https://dev.twitter.com/docs/rate-limiting/1.1 
// 
// https://dev.twitter.com/docs/auth/authorizing-request
// http://stackoverflow.com/questions/12333289/node-js-fetching-twitter-streaming-api-eaddrnotavail
// *** https://dev.twitter.com/docs/api/1.1/post/statuses/filter
// http://stackoverflow.com/questions/12308246/how-to-implement-observer-pattern-in-javascript
// https://dev.twitter.com/docs/streaming-apis/streams/public#Connections  // ONLY ONE CONNECTION TO PUBLIC API

var https = require('https');
var OAuth = require('oauth').OAuth;
var moment = require('moment');

var c = require('../config').config;  // App configuration

// Constructor
function Stream(user, streamType) {
	this.oa = new OAuth(
		'http://' + c.twitter.rootUrl + c.twitter.requestPath,
		'http://' + c.twitter.rootUrl + c.twitter.tokenPath,
		c.twitter.consumerKey,
		c.twitter.consumerSecret,
		'1.0A',
		null,
		'HMAC-SHA1'
	);
	this.user = user;
	this.streamType = streamType;
	this.observers = [];  // Array of observer functions to notify when a new tweet is available. 
	this.request = null;  // The HTTP request object, used to abort the stream later. 	
	this.searchTerm = null;
	me = this;  // Help control scope. 
}

// Function to add a new subscriber. 
Stream.prototype.subscribe = function(fn) {
	this.observers.push(fn);
};

// Function to remove a subscriber. 
Stream.prototype.unsubscribe = function(fn) {
	for (var ii=0; ii<this.observers.length; ii++) {
		if (this.observers[ii] == fn) {
			this.observers.splice(ii, 1);
			break;
		}
	}
};

// Function to start a new Twitter stream. 
Stream.prototype.start = function(searchTerm, mapBounds, callback) {
	if (searchTerm && searchTerm.length > 0) this.searchTerm = searchTerm.toLowerCase();
	var options = {
		headers : {},
		agent : false
	};
	
	if (me.streamType == 'public') {
		options.host = 'stream.twitter.com';
		
		if (searchTerm && searchTerm.length > 0) {
			options.path = '/1.1/statuses/filter.json?track=' + encodeURIComponent(searchTerm);	
			options.path += '&filter_level=medium';
			
		} else if (mapBounds && mapBounds.length > 0) {
			options.path = '/1.1/statuses/filter.json?locations=' + mapBounds;
		} else {
			// Not enough data to search
			callback('Not enough data provided to search. Please provide a search term or map bounds to query.');
		}
		options.method = 'POST';
	} else { // if (me.streamType == 'user') {  // default to user stream
		options.host = 'userstream.twitter.com';
		options.path = '/1.1/user.json';
		options.path += '?stall_warnings=true';
		options.path += '&with=followings&replies=all';	
		options.method = 'GET';
	}
		
	// Build up the OAuth header for the HTTP request. 
	options.headers.Authorization = this.oa.authHeader('https://' + options.host + options.path, me.user.token, me.user.tokenSecret, options.method);
	
	// Start up the stream. 
	this.request = https.request(options, function(response){ 
		response.on("data",function(chunk) {
			try {
				var tweet = JSON.parse(chunk);  // Each chunk is an individual tweet. 				
				if (tweet.user) {  // Check this is a tweet, not another object from the firehose.
					tweet = cleanupTweet(tweet, [searchTerm]);
				
					// Notify all observers of the new tweet. 
					for (var ii=0; ii<me.observers.length; ii++) {
						me.observers[ii](tweet);
					}			
				} else {
					/* other statuses come from the Twitter API
						{"disconnect":{"code":7,"stream_name":"shoe_sandbox-statuses4480022","reason":"admin logout"}}
					*/
					console.log(JSON.stringify(tweet));
				}
			} catch (ex) {
				console.log('ERROR: ' + ex);
				callback(ex);
			}
		});  
		
		// Handler once the request is complete. 
		response.on('end', function() { 
			console.log('RESPONSE ENDED.');
			callback(null);
		});
	});  
	this.request.end();  // Start the request.	
	callback(null);
};

module.exports.Stream = Stream;


// Function to refine the tweet object. 
function cleanupTweet(tweet, keywords) {

	var tweetDate = moment(tweet.created_at);
	tweet.created_display_short = tweetDate.format('MMM D HH:mm');
	tweet.created_display_long = tweetDate.format('MMM Do YYYY, H:mm A');
	tweet.created_display_time = tweetDate.format('HH:mm:ss');

	tweet.html = tweet.text;

	if (tweet.html) {  // some tweets are without text
		// Identify keywords
		for (var ii=0; ii<keywords.length; ii++) {
			var regex = new RegExp( '(' + keywords[ii] + ')', 'gi' );
			tweet.html = tweet.html.replace(regex, '<span class="keyword">$1</span>');
		}
		
		// Clean up URLs
		if (tweet.entities && tweet.entities.urls && tweet.entities.urls.length > 0) {
			for (var ii=0; ii<tweet.entities.urls.length; ii++) {
				tweet.html = tweet.html.replace(tweet.entities.urls[ii].url, '<a href="' + tweet.entities.urls[ii].expanded_url + '" target="_blank">' + tweet.entities.urls[ii].display_url + '</a>');
			}
		}
		
		// Clean up Media URLs
		if (tweet.entities && tweet.entities.media && tweet.entities.media.length > 0) {
			for (var ii=0; ii<tweet.entities.media.length; ii++) {
				tweet.html = tweet.html.replace(tweet.entities.media[ii].url, '<a href="' + tweet.entities.media[ii].expanded_url + '" target="_blank">' + tweet.entities.media[ii].display_url + '</a>');
			}
		}
		
		// Clean up hashtags
		if (tweet.entities && tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
			for (var jj=0; jj<tweet.entities.hashtags.length; jj++) {
				var regEx = new RegExp('#' + tweet.entities.hashtags[jj].text, "ig");  // Using regex to ensure find/replace is case-insensitive. 
				tweet.html = tweet.html.replace(regEx, '<a href="http://twitter.com/search?src=hash&q=%23' + tweet.entities.hashtags[jj].text + '" target="_blank">#' + tweet.entities.hashtags[jj].text + '</a>');
			}
		}
		
		// Clean up @mentions
		if (tweet.entities && tweet.entities.user_mentions && tweet.entities.user_mentions.length > 0) {
			for (var jj=0; jj<tweet.entities.user_mentions.length; jj++) {
				var regEx = new RegExp('@' + tweet.entities.user_mentions[jj].screen_name, "ig");  // Using regex to ensure find/replace is case-insensitive. 
				tweet.html = tweet.html.replace(regEx, '<a href="http://twitter.com/' + tweet.entities.user_mentions[jj].screen_name + '" target="_blank" data-placement="top" data-toggle="tooltip" data-original-title="' + tweet.entities.user_mentions[jj].name + '">@' + tweet.entities.user_mentions[jj].screen_name + '</a>');
			}
		}
	}
	
	return tweet;
}

// Verify the Twitter credentials are valid, return user details. 
// https://dev.twitter.com/docs/api/1.1/get/account/verify_credentials
exports.validateCredentials = function(userToken, userTokenSecret, callback) {
	var options = {
		host: c.twitter.rootUrl,
		path: '/1.1/account/verify_credentials.json',
		headers: {},
		method: 'GET'
	};
	
	oa = new OAuth(
		'http://' + c.twitter.rootUrl + c.twitter.requestPath,
		'http://' + c.twitter.rootUrl + c.twitter.tokenPath,
		c.twitter.consumerKey,
		c.twitter.consumerSecret,
		'1.0A',
		null,
		'HMAC-SHA1'
	);
	
	// Build up the OAuth header for the HTTP request. 
	options.headers.Authorization = oa.authHeader('https://' + options.host + options.path, userToken, userTokenSecret, options.method);

	var json = '';  // String to build up API response
	https.get(options, function(res){ 
		// Handler for each chunk of data in the response from the API
		res.on('data', function (chunk) { 
			json += chunk;  // Append this chunk
		});
		
		// Handler once the request to the API is complete. 
		res.on('end', function() { 
			var data = JSON.parse(json);  // Turn the string into an object.
			if(!data.errors)
				callback(null, data);
			else
				callback(data.errors[0], null);
		});

	}).on('error', function(err) {
			console.log("Encountered error: " + err.message);
		});
};
