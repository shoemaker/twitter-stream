var https = require('https');
var OAuth = require('oauth').OAuth;
var Twit = require('twit')
var moment = require('moment');
var _ = require('lodash');

var c = require('../config').config;  // App configuration

// Constructor
function Stream(user, streamType) {
    this.user = user;
    this.streamType = streamType;
    this.tweetObservers = [];  // Array of observer functions to notify when a new tweet is available. 
    this.msgObservers = [];  // Array of observers to notify when a new message (non-tweet) is available. 
    this.tweetStream = null;  // The HTTP request object. 
    this.searchTerm = null;
    me = this;  // Help control scope. 
}

// Function to add a new subscriber. 
Stream.prototype.subscribe = function(type, fn) {
    if (type == 'tweet') this.tweetObservers.push(fn);
    else if (type == 'message') this.msgObservers.push(fn);
};

// Function to remove a subscriber. 
Stream.prototype.unsubscribe = function(type, fn) {
    if (type == 'tweet') {    
        for (var ii=0; ii<this.tweetObservers.length; ii++) {
            if (this.tweetObservers[ii] == fn) {
                this.tweetObservers.splice(ii, 1);
                break;
            }
        }
    } else if (type == 'message') {
        for (var ii=0; ii<this.msgObservers.length; ii++) {
            if (this.msgObservers[ii] == fn) {
                this.msgObservers.splice(ii, 1);
                break;
            }
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
    this.tweetStream = T.stream(path, options);
    this.tweetStream.on('tweet', function(tweet) {
        try {
            if (tweet.user) {  // Check this is a tweet, not another object from the firehose.
                tweet = cleanupTweet(tweet, [searchTerm]);
            
                // Notify all tweet observers of the new tweet. 
                _.forEach(me.tweetObservers, function (observer) {
                    observer(tweet);
                })
            } else {
                /* other statuses come from the Twitter API
                    {"disconnect":{"code":7,"stream_name":"shoe_sandbox-statuses4480022","reason":"admin logout"}}
                */
                console.log(JSON.stringify(tweet));
            }
        } catch (ex) {
            console.log('ERROR: ' + ex);

            // Notify message observers of the issue. 
            _.forEach(me.msgObservers, function (observer) {
                observer(limitMessage);
            }); 
            
            callback(ex);
        }
    });

    this.tweetStream.on('limit', function (limitMessage) {
        // Notify message observers of the new message. 
        _.forEach(me.msgObservers, function (observer) {
            observer(limitMessage);
        });
    });

    this.tweetStream.on('warning', function (warningMessage) {
        // Notify message observers of the new message. 
        _.forEach(me.msgObservers, function (observer) {
            observer(limitMessage);
        });
    });

    this.tweetStream.on('disconnect', function (disconnectMessage) {
        // Notify message observers of the new message. 
        _.forEach(me.msgObservers, function (observer) {
            observer(limitMessage);
        });
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
        _.forEach(keywords, function(keyword) {
            var regex = new RegExp( '(' + keyword + ')', 'gi' );
            tweet.html = tweet.html.replace(regex, '<span class="keyword">$1</span>');
        });
        
        // Clean up URLs
        _.forEach(tweet.entities.urls, function(url) {
            tweet.html = tweet.html.replace(url.url, _.template('<a href="<%=expanded_url%>" target="_blank"><%=display_url%></a>', url));
        });

        // Clean up Media URLs
        _.forEach(tweet.entities.media, function(url) {
            tweet.html = tweet.html.replace(url.url, _.template('<a href="<%=expanded_url%>" target="_blank"><%=display_url%></a>', url));
        });
        
        // Clean up hashtags
        _.forEach(tweet.entities.hashtags, function(hashtag) {
            var regEx = new RegExp('#' + hashtag.text, "ig");  // Using regex to ensure find/replace is case-insensitive. 
            tweet.html = tweet.html.replace(regEx, _.template('<a href="http://twitter.com/search?src=hash&q=%23<%=text%>" target="_blank">#<%=text%></a>', hashtag));
        });
        
        // Clean up @mentions
        _.forEach(tweet.entities.user_mentions, function(mention) {
            var regEx = new RegExp('@' + mention.screen_name, "ig");  // Using regex to ensure find/replace is case-insensitive. 
            tweet.html = tweet.html.replace(regEx, _.template('<a href="http://twitter.com/<%=screen_name%>" target="_blank" data-placement="top" data-toggle="tooltip" data-original-title="<%=name%>">@<%=screen_name%></a>', mention));
        });
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
