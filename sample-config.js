exports.config = {
	port : 8088,
	twitter : {
		// userToken/userTokenSecret are optional properties. MUST populate if you wish to run this app from your desktop.
		// Details can be found in the README.md. 
		userToken : null,  // OAuth token, granted by Twitter, for a specific user. Only use if bypassing the shoe.io/auth flow. 
		userTokenSecret : null,  // OAuth token secret, granted by Twitter, for a specific user. Only use if bypassing the shoe.io/auth flow.
		
		// The following properties are required. 
		consumerKey : null,  // OAuth consumer key for an app, granted by Twitter. 
		consumerSecret : null,  // OAuth consumer secret for an app, granted by Twitter. 
		
		rootUrl : 'api.twitter.com',
		requestPath : '/oauth/request_token',
		authorizePath : '/oauth/authenticate?oauth_token={0}',
		tokenPath : '/oauth/access_token'
	},
	
	// If using shoe.io/auth for authentication, this section is needed. 
	// If the userToken/userTokenSecret is provided above, this section is ignored. 
	dbs : {
		auth : {
			dbHost: null,
			dbPort: null,
			dbName: null,
			dbUsername: null,
			dbPassword: null			
		}
	},
	cacheDuration: 900000,
	
	// Because of Twitter's ToS, limit which users can actually use this app. 
	// The list is only referenced if no userToken/userTokenSecret has been specified above. 
	superUsers : []  
}