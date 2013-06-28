var mongo = require('mongodb'),  // Init MongoDB library
	Db = mongo.Db;
var ObjectID = require('mongodb').ObjectID;
	
var c = require('../config').config;  // App configuration
var twitter = require('./twitter.js');
var models = require('../models/models');

// Retrieve a user by their unique ID in the DB. 
exports.getUser = function(id, callback) {
	if (c.twitter.userToken && c.twitter.userTokenSecret) {  // Using a hardcoded user token/secret, bypassing shoe.io/auth. 
		// Validate token/secret, retrieve user details. 
		twitter.validateCredentials(c.twitter.userToken, c.twitter.userTokenSecret, function(err, data) {	
			if (err) {
				callback(err, null)
			} else {
				// Populate a user service object.
				var user = models.user();
				user.services.twitter.token = c.twitter.userToken;
				user.services.twitter.tokenSecret = c.twitter.userTokenSecret;
				user.services.twitter.username = data.screen_name;
				user.services.twitter.avatarUrl = data.profile_image_url_https;
				callback(null, user);
			}
		});		
	} else if (id) {  // "Normal" workflow, retrieving record from shoe.io/auth. 
		var o_id = ObjectID.createFromHexString(id);
		var query = { '_id' : o_id};
		Db.connect(buildMongoURL(), function(err, db) {
			if(!err) {	
				db.collection('users', {safe:false}, function(err, collection) {
					collection.findAndModify(query, [['_id','asc']], { $set : { dateAccessed : new Date() } }, {}, callback);
				});
			} else {
				callback(err, null);
			}
		});
	} else {
		callback(null, { });
	}
};


// Helper functions

// Build the connection string to the MongoDB instance for this application
function buildMongoURL() { 
	if(c.dbs.auth.dbUsername && c.dbs.auth.dbPassword) {
		return 'mongodb://' + c.dbs.auth.dbUsername + ':' + c.dbs.auth.dbPassword + '@' + c.dbs.auth.dbHost + ':' + c.dbs.auth.dbPort + '/' + c.dbs.auth.dbName + '?auto_reconnect=true&safe=true';
	} else { 
		return 'mongodb://' + c.dbs.auth.dbHost + ':' + c.dbs.auth.dbPort + '/' + c.dbs.auth.dbName + '?auto_reconnect=true&safe=true'; 
	}
}

// Build the Gravatar URL
function buildGravatarUrl(email) {
	if (!email || email.length == 0) email = 'foo';
	var crypto = require('crypto');
	var hash = crypto.createHash('md5').update(email).digest("hex");
	console.log(hash);
	var url = c.gravatarAvatarUrl.format(hash);
	return url;
}