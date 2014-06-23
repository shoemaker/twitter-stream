// https://dev.twitter.com/docs/rate-limiting/1.1 
// 
// https://dev.twitter.com/docs/auth/authorizing-request
// http://stackoverflow.com/questions/12333289/node-js-fetching-twitter-streaming-api-eaddrnotavail
// *** https://dev.twitter.com/docs/api/1.1/post/statuses/filter
// http://stackoverflow.com/questions/12308246/how-to-implement-observer-pattern-in-javascript
// https://dev.twitter.com/docs/streaming-apis/streams/public#Connections  // ONLY ONE CONNECTION TO PUBLIC API
// https://github.com/ttezel/twit

var https = require('https');
var OAuth = require('oauth').OAuth;
var Twit = require('twit')
var moment = require('moment');

var c = require('../config').config;  // App configuration

// Constructor
function Stream(user, streamType) {
    this.user = user;
    this.streamType = streamType;
    this.observers = [];  // Array of observer functions to notify when a new tweet is available. 
    this.twStream = null;  // The HTTP request object. 
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
    var T = new Twit({
        consumer_key: c.twitter.consumerKey
        , consumer_secret: c.twitter.consumerSecret
        , access_token: me.user.token
        , access_token_secret: me.user.tokenSecret
    });

    var path,
        options = {};
    
    // Build up the Twitter query. 
    if (me.streamType == 'public') { 
        path = 'statuses/filter';
        if (searchTerm && searchTerm.length > 0) {
            options.track = searchTerm.toLowerCase();
        } else if (mapBounds) {
            // Sanity check, map bounds should be four item array
            if (mapBounds.length !== 4) callback('Map bounds must contain four points.'); 
            else options.locations = mapBounds; 
        }
        options.filter_level = 'medium';
    } else {  // if (me.streamType == 'user') {  // default to user stream
        path = 'user';
        options.with = 'followings';
        options.replies = 'all';
    }

    // Start up the stream. 
    this.twStream = T.stream(path, options);
    this.twStream.on('tweet', function(tweet) {
        try {
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

    this.twStream.on('limit', function (limitMessage) {
        console.log('LIMIT MESSAGE:', limitMessage);
        callback(null);
    })

    this.twStream.on('disconnect', function(message) {
        console.log('RESPONSE ENDED.');
        callback(null);
    });
};

module.exports.Stream = Stream;


// Function to refine the tweet object. 
function cleanupTweet(tweet, keywords) {
    var tweetDate = moment(tweet.created_at, 'ddd MMM D HH:mm:ss ZZ YYYY');
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
