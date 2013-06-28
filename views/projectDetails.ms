<p>
	This project uses the <a href="https://dev.twitter.com/docs/streaming-apis" target="_blank">Twitter Streaming APIs</a> to search on a provided term. The results are then displayed, mapped, and the entities within the tweet aggregated and sorted by popularity. 
	I was looking for a reason to play with <a href="http://en.wikipedia.org/wiki/WebSocket" target="_blank">web sockets</a> and the <a href="http://socket.io/" target="_blank">socket.io</a> library. 
	Twitter provided a great content source for streaming content. 
	This project also provided a good opportunity to make use of the <a href="http://en.wikipedia.org/wiki/Observer_pattern" target="_blank">observer pattern</a>, both on the server and the browser. 
	As tweets come across the wire, any number of subscribers are notified and handle the incoming tweet to carry out their defined function. This is the first time I've used this pattern on a project using Node.js. 
	I also used <a href="http://olado.github.io/doT/" target="_blank">doT.js</a> for client-side templating, which proved to be blazingly fast. 
</p>
