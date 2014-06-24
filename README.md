# Twitter Stream

### Check out this project in action at [http://shoe.io/stream](http://shoe.io/stream).

This project uses the [Twitter Streaming APIs](https://dev.twitter.com/docs/streaming-apis) to search on a provided term. The results are then displayed, mapped, and the entities within the tweet aggregated and sorted by popularity. 
I was looking for a reason to play with [web sockets](http://en.wikipedia.org/wiki/WebSocket) and the [socket.io](http://socket.io) library. 
Twitter provided a great content source for streaming content. 
This project also provided a good opportunity to make use of the [observer pattern](http://en.wikipedia.org/wiki/Observer_pattern), both on the server and the browser. 
As tweets come across the wire, various subscribers are notified and handle the incoming tweet to carry out their defined function. This is the first time I've used this pattern on a project using Node.js. 
I also used [doT.js](http://olado.github.io/doT/) for client-side templating, which proved to be blazingly fast. 

This will continue to be a learning/sandbox project.  

## Configuration
Install dependencies. 
	
	$ npm install
	$ bower install

Rename 'sample-config.js' to 'config.js' or obtain the decryption key for the Makefile.

Register a new application with [Twitter](https://dev.twitter.com/apps) or use the keys from an existing registered app. Update config.js with your consumerKey and consumerSecret.

Retrieve an [OAuth token and token secret](https://dev.twitter.com/apps) from Twitter. 
Click on an application then click the "Oauth tool" tab. Update config.js with userToken and userTokenSecret.  

Fire up the site

	npm start

Navigate to `http://localhost:8088/stream`


## Open Issues
I had hoped to host this project and allow multiple users to access their Twitter user stream. However I ran into an issue that prevented each user from receiving their individual stream. 
As each new web socket stream is created, a new HTTP connection is opened to the Twitter API to receive the incoming stream. It seems that the last opened HTTP connection is intercepting 
all incoming HTTP traffic from all HTTP streams to the Twitter streaming API. 

For example if userA and userB both opened a stream, userB (who established their connection last) would receive the incoming stream from user A in addition to their own. 
I was unable to diagnose the cause and a solution, this is a work in progress. 

## Notes 

Details on [rate limiting](https://dev.twitter.com/docs/rate-limiting/1.1) using the Twitter streaming API.  
How to [authorize a request](https://dev.twitter.com/docs/auth/authorizing-request) with the Twitter API.  
How to [filter statuses](https://dev.twitter.com/docs/api/1.1/post/statuses/filter) from the Twitter streaming API.  
Only [one stream per IP address](https://dev.twitter.com/docs/streaming-apis/streams/public#Connections) is allowed.  
Useful [Node.js Twitter Client](https://github.com/ttezel/twit) used for this project.  
