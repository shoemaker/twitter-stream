
// this closure helps keep the global namespace clean
(function($) {

	// init the socket.io object
	var socket = io.connect('http://' + location.host, { 
		resource: 'stream/socket.io',
		'force new connection' : false
	});
	
	// ****** STREAM OBJECT ******
	
	// define the Stream global object
	Stream = function() {
		// define private class variables
		var subscribers	= [];
		var searchTerm;
		var mapBoundary;
		var isSearching = false;

		// prepare the object for incoming messages
		function init() {
			// Handler for messages. 
			socket.on('msg', function(data) { 
				displayMessage('alert-info', 'Server Message', data.messages);
			});
				
			// Handler for tweets
			socket.on('tweet', function(data) { 
				publish(data);  // publish this new tweet to subscribers. 
			});
			
			// Handler for losing connection
			socket.on('disconnect', function(data) {
				displayMessage('alert-error', 'Fatal Error', [ { msg: 'Disconnected. Please refresh the page and try your search again.' } ]);
				var url = document.URL.split('?')[0];
				if (searchTerm && searchTerm.length > 0) url += '?q=' + searchTerm;
				// window.location.href = url;
			});
		}
	
		// Add new subscriber
		function subscribe(fn) {
			subscribers.push(fn);
		}
		
		// Remove a subscriber
		function unsubscribe(fn) {
			for (var ii=0; ii<subscribers.length; ii++) {
				if (subscribers[ii] == fn) { 
					subscribers.splice(ii, 1);
					break;
				}
			}
		}

		// Push (publish) a new tweet to all subscribers
		function publish(tweet) {
			for (var ii=0; ii<subscribers.length; ii++) {
				subscribers[ii](tweet);
			}	
		}
		
		// Check for connectivity from the server
		function checkHeartbeat() {
			socket.emit('heartbeat', { 'searchTerm' : searchTerm }); 
		}
		
		
		// Kick off a new stream
		// https://dev.twitter.com/docs/streaming-apis/parameters#locations
		function startStream(query, mapBounds) {
			searchTerm = query;
			mapBoundary = mapBounds;
			isSearching = true;
			socket.emit('control', { 'action' : 'start', 'searchTerm': searchTerm, 'mapBounds' : mapBounds, 'userid' : getCookieValue('userid') }); 
		}
		
		// Close (stop) an existing stream
		function stopStream() {
			isSearching = false;
			socket.emit('control', { 'action' : 'stop', 'userid' : getCookieValue('userid') }); 
		};
	
	
		// run init
		init();
		
		// define component's public interface
		return {
			attach	 			: subscribe,
			detach				: unsubscribe,
			start 				: startStream,
			stop 				: stopStream,
			checkHeartbeat		: checkHeartbeat,
			isSearching			: isSearching
		}
	};
	
	// ****** END STREAM OBJECT ******
	
	
	// ****** DISPLAY OBJECT ******
	
	// define the Display global object
	// used to manage the display of items in the stream
	Display = function() {
		// define private class variables		
		var maxTweetDisplay = 10;  // The maximum number of tweets to display at a time. 
		var maxEntityDisplay = 30;
		var tweetCount = 0;
		var hashtagClicked = [];
		
		function renderTweet(tweet) {
			// Render the tweet using a doT template. 
			var template = doT.template($('#tweetTemplate').html());
			var html = template(tweet);
			$('#tweetContainer').prepend(html);			
			$('#tweetContainer .tweet:gt(' + maxTweetDisplay + ')').remove();
			$('#tweetContainer a:not(.ignore)').attr('target', '_blank'); 
		}
		
		function incrementCounter() {
			tweetCount++;
			$('#tweetCount').html(tweetCount);
		}
		
		
		function renderLinks(links) {
			if (!links) links = [];
			var displayLinks = links.slice(0, maxEntityDisplay);
			var template = doT.template($('#linkTemplate').html());
			var html = template(displayLinks);
			$('#linkContainer').html(html);
			
			// New links have been added to the page. Open all links in a new window.
			$('#linkContainer a:not(.ignore)').attr('target', '_blank'); 
		}
		
		
		function renderHashtags(hashtags) {
			if (!hashtags) hashtags = [];
			var displayHashtags = hashtags.slice(0, maxEntityDisplay);
			displayHashtags.sort(sort_by('hashtag', false, function(a){return a.toUpperCase()}));
			var template = doT.template($('#hashtagTemplate').html());
			var html = template(displayHashtags);
			$('#hashtagContainer').html(html);
			
			// Turn this list into a tag cloud
			$('#hashtagContainer span').tagcloud();
			
			// Add handler to kick off a new search when a hashtag has been clicked. 
			$('#hashtagContainer span').click(function(ev) {
				// only "super users" with access to the public stream can kick off a new search. 
				if ($('#txtSearch')) {
					if (hashtagClicked[0]) hashtagClicked[0]('#' + $(this).attr('data'));
				} else {
					window.open('https://twitter.com/search?q=%23' + $(this).attr('data'));
				}
			});
		}
		

		function renderMentions(mentions) {
			if (!mentions) mentions = [];
			var displayMentions = mentions.slice(0, maxEntityDisplay);
			displayMentions.sort(sort_by('screen_name', false, function(a){return a.toUpperCase()}));
			var template = doT.template($('#mentionTemplate').html());
			var html = template(displayMentions);
			$('#mentionContainer').html(html);

			// Turn this into a tag cloud
			$('#mentionContainer a').tagcloud();
			
			// New links have been added to the page. Open all links in a new window.
			$('#mentionContainer a:not(.ignore)').attr('target', '_blank'); 
		}
		
		
		function renderPhotos(photos) {
			var template = doT.template($('#photoTemplate').html());
			var html = template(photos);
			$('#photoContainer ul').prepend(html);			
			$('#photoContainer ul li:gt(' + maxEntityDisplay + ')').remove();
			
			// New links have been added to the page. Open all links in a new window.
			$('.photo a:not(.ignore)').attr('target', '_blank'); 
		}
		

		// Reset the display to a "new" state
		function reset() {
			$('#tweetContainer').empty();
			tweetCount = 0;
			$('#tweetCount').html(tweetCount);
			$('#photoContainer ul').empty();

			renderTweet();
			renderLinks();
			renderHashtags();
			renderMentions();
			renderPhotos();
		}
		
		// define component's public interface
		return {
			renderTweet 	: renderTweet,
			increment		: incrementCounter,
			renderLinks 	: renderLinks,
			renderHashtags 	: renderHashtags,
			renderMentions 	: renderMentions,
			renderPhotos 	: renderPhotos,
			hashtagClicked	: hashtagClicked,
			reset			: reset
		}
	};
	
	// ****** END DISPLAY OBJECT ******
	
	
	// ****** ENTITY OBJECT ******
	
	// define the Entities global object
	// used to manage incoming entities within the stream
	Entities = function() {
		// define private class variables
		var links		= [];
		var hashtags	= [];
		var mentions	= [];
		var photos		= [];
		
		// Extract (harvest) the meta-data from a tweet
		function harvestEntities(tweet) {
			if (tweet.entities) {

				// Extract links
				for (var ii=0; ii<tweet.entities.urls.length; ii++) {
					saveLink(tweet.entities.urls[ii]);
				}
				links.sort(sort_by('count', true, parseInt));
				
				// Extract hashtags
				for (var ii=0; ii<tweet.entities.hashtags.length; ii++) {
					saveHashtag(tweet.entities.hashtags[ii]);
				}
				hashtags.sort(sort_by('count', true, parseInt));
								
				// Extract mentions
				for (var ii=0; ii<tweet.entities.user_mentions.length; ii++) {
					saveMention(tweet.entities.user_mentions[ii]);
				}
				mentions.sort(sort_by('count', true, parseInt));
								
				// Extract media items
				if (tweet.entities.media) {
					for (var ii=0; ii<tweet.entities.media.length; ii++) {
						if (tweet.entities.media[ii].type.toLowerCase() == 'photo') {
							photos.unshift(tweet.entities.media[ii]);
						}
					}
				}
			}
		}
		
		
		function saveLink(item) {
			var found = false;
			for (var ii=0; ii<links.length; ii++) {
				if (links[ii].url == item.expanded_url) {
					found = true;
					links[ii].count++;
					break;
				}
			}
			
			if (!found) {  // new link
				links.unshift( { 'item' : item, 'url' : item.expanded_url, 'count' : 1 } );
			}
			
			return;
		}
		
		
		function saveHashtag(item) { 
			var found = false;
			for (var ii=0; ii<hashtags.length; ii++) {
				if (hashtags[ii].hashtag.toLowerCase() == item.text.toLowerCase()) {
					found = true;
					hashtags[ii].count++;
					break;
				}
			}
			
			if (!found) {  // new link
				hashtags.unshift( { 'item' : item, 'hashtag' : item.text, 'count' : 1 } );
			}
			
			return;
		}
		

		function saveMention(item) {
			var found = false;
			for (var ii=0; ii<mentions.length; ii++) {
				if (mentions[ii].screen_name.toLowerCase() == item.screen_name.toLowerCase()) {
					found = true;
					mentions[ii].count++;
					break;
				}
			}
			
			if (!found) {  // new link
				mentions.unshift( { 'item' : item, 'screen_name' : item.screen_name, 'count' : 1 } );
			}
			
			return;
		}	

		
		function reset() {
			links.length = 0;
			hashtags.length = 0;
			mentions.length = 0;
			photos.length = 0;
		}
		
		// define component's public interface
		return {
			harvest 		: harvestEntities,
			links			: links,
			hashtags		: hashtags,
			mentions		: mentions,
			photos		  	: photos,
			reset			: reset
		}
	};
	
	// ****** END ENTITY OBJECT ******
	
	
	// ****** LOCATION OBJECT ******
	
	// define the Location global object
	// used to map incoming items within the stream
	Location = function() {
		// define private class variables
		var maxDisplay	= 50;
		var markers		= [];
		var lastInfoWindow = null;
		var map;
		
		// https://developers.google.com/maps/documentation/javascript/tutorial
		google.maps.event.addDomListener(window, 'load', function() {
			var mapOptions = {
				center: new google.maps.LatLng(39.8282, -98.5795),  // the geographic center of the US. 
				zoom: 3,
				mapTypeId: google.maps.MapTypeId.ROADMAP
	        };
	        map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);
		});
		
		function mapTweet(tweet) {
			if (tweet.coordinates && tweet.coordinates.coordinates) {				
				// Determine if the tweet falls within the bounds of the map.
				var bounds = getMapBounds();
				var southWest = bounds.southWest;
				var northEast = bounds.northEast;
				
				// within bounds for latitude and longitude?
				var constrainMap = false;  // set to true if you only want to drop markers if on the currently visible map. 
				var withinLat = (tweet.coordinates.coordinates[1] >= southWest.lat() && tweet.coordinates.coordinates[1] <= northEast.lat());
				var withinLon = (tweet.coordinates.coordinates[0] >= southWest.lng() && tweet.coordinates.coordinates[0] <= northEast.lng());
				if (!constrainMap || (withinLat && withinLon)) {					
					var latlng = new google.maps.LatLng(tweet.coordinates.coordinates[1], tweet.coordinates.coordinates[0]);
					var marker = new google.maps.Marker({
						position: latlng,
						map: map,
						title: (tweet.place && tweet.place.name) ? tweet.place.name : null,
						draggable: false,
						animation: google.maps.Animation.DROP
					});

					var template = doT.template($('#mapTweetTemplate').html());
					var html = template(tweet);					
					var newInfoWindow = new google.maps.InfoWindow({
						content: html,
						maxWidth: ($('#map_canvas').width() / 2)
					});

					var listener = google.maps.event.addListener(marker, 'click', function() {
						if (lastInfoWindow)
							lastInfoWindow.close();
						newInfoWindow.open(map, marker);
						lastInfoWindow = newInfoWindow;
					});
					
					// Add this marker to the array
					markers.unshift({ 'marker' : marker, 'listener' : listener });
				}
			}
			
			// ensure that only the most recent markers stay on the map
			cleanupMarkers();
		}
		
		function cleanupMarkers() { 
			var toRemove = markers.splice(maxDisplay, markers.length-1);
			for (var ii=0; ii<toRemove.length; ii++)
				removeMarker(toRemove[ii]);
		}
		
		function removeMarker(marker) {
			// Remove the listener
			google.maps.event.removeListener(marker.listener);			
			// Remove the marker
			marker.marker.setMap(null);
		}
		
		function clickRandomMarker() {
			var rnd = Math.floor(Math.random() * markers.length);
			google.maps.event.trigger(markers[rnd].marker, 'click');
		}
		
		function getMapBounds() {
			if (map) {
				var bounds = map.getBounds();
				var southWest = bounds.getSouthWest();
				var northEast = bounds.getNorthEast();
				
				return { 'southWest' : southWest, 'northEast' : northEast };
			} else { return null; }
		}
		
		function reset() {
			for (var ii=0; ii<markers.length; ii++) {
				removeMarker(markers[ii]);
			}
		}
		
		// define component's public interface
		return {
			map 				: mapTweet,
			getMapBounds		: getMapBounds,
			clickRandomMarker 	: clickRandomMarker,
			reset				: reset
		}
	};
	
	// ****** END LOCATION OBJECT ******
	
})(jQuery);


(function($) {

	var stream		= new Stream();
	var display		= new Display();
	var entities 	= new Entities();
	var loc 		= new Location();
	var timeoutID;  // identifier for the timeout interval to kill a long-running stream. 
	var timeoutDuration = 3600000;  // 60 minutes

	// init defaults for generating tag clouds
	$.fn.tagcloud.defaults = {
		size: { start: 14, end: 22, unit: 'px' },
		color: { start: '#cde', end: '#f52' }
	};
	
	// Master function to reset the page. 
	function resetAll() {
		if (stream.isSearching) { 
			$('#btnToggle').click();
		}
		
		loc.reset();
		display.reset();
		entities.reset();
		
		// Attach an handler to init a new search for anything with a 'searchTerm' class. 
		$('.searchTerm').click(function() {
			newSearch($(this).html());
		});	
	}
	
	// Event handler to kick off handle a new search term.
	// typically used when clicking on a hashtag or inline documentation. 
	function newSearch(searchTerm) {
		$('html, body').animate({
			scrollTop: $("#txtSearch").offset().top - 10
		}, 500);
		
		resetAll();
		
		$('#txtSearch').val(searchTerm);
		//stream.start($('#txtSearch').val(), loc.getMapBounds());
		
		return false;
	}
	
	
	// init objects required for handling incoming tweets. 
	function init() {
		display.hashtagClicked.push(newSearch);
		
		// Set up subscriptions
		stream.attach(display.renderTweet);
		stream.attach(display.increment);
		stream.attach(entities.harvest);
		stream.attach(loc.map);
	}

	
	(function() {

		$('document').ready(function() {
			
			// pre-populate the search if a querystring value provided.
			if ($('#txtSearch') && getQuerystringValue('q')) $('#txtSearch').val(getQuerystringValue('q'));
			
			// Load the templates used by this page
			$.ajax({
		        url: '/stream/templates',
		        method: 'GET',
		        success: function(response) {
		            $('footer').after(response);
		        },
		        error: function(ex) {
		            console.log(ex);
		        },
		        complete: function() {
		        	resetAll();  // Init the templates with empty dataset, displaying the default content. Trying to keep things DRY. 
					init();
		        }
			});
			
			// Event handler for the search button
			$('#btnToggle').click(function() {
				if (!stream.isSearching) {
					var searchTerm = $('#txtSearch').val();
					var mapBounds = null;
					if ($('#chkMapSearch').is(':checked')) {
						var bounds = loc.getMapBounds();
						mapBounds = bounds.southWest.lng() + ',' + bounds.southWest.lat() + ',' + bounds.northEast.lng() + ',' + bounds.northEast.lat();
					}
					
					stream.start(searchTerm, mapBounds);
					$(this).attr('class', 'btn btn-danger');
					$(this).html('<i class="icon-stop icon-white"></i> Stop');
					timeoutID = setTimeout(function() {
						if (stream.isSearching) { 
							$('#btnToggle').click();
							var msg = 'Stream closed after ' + (timeoutDuration/1000/60) + ' minutes. Click "Start" to resume your stream.';
							displayMessage('alert-error', 'Time Out', [ { 'msg': msg }]);
						}
					}, timeoutDuration);
				} else {
					stream.stop();
					$(this).attr('class', 'btn btn-success');
					$(this).html('<i class="icon-play icon-white"></i> Start');
					clearTimeout(timeoutID);
				}

				stream.isSearching = !stream.isSearching;
			});
			
			// Event handler for the reset button
			$('#btnReset').click(function() {
				resetAll();
			});
			
			// Attach a handler to capture the "ENTER" key on the search box. 
			$('#txtSearch').bind('keypress', function(e) {
			var code = (e.keyCode ? e.keyCode : e.which);
				if(code == 13) { //Enter keycode
					if (stream.isSearching) {
						stream.stop();
						stream.start($('#txtSearch').val(), null);
					} else {
						$('#btnToggle').click();
					}
				}
			});
			
			// Attach event handler to the photo toggle
			$('#chkEnablePhotos').attr('checked', false);
			$('#chkEnablePhotos').click(function() {
				if ($('#chkEnablePhotos').is(':checked')) {
					$('#photoRow').show('fast');
				} else {
					$('#photoRow').hide('slow');					
				}
			});
			$('#lblEnablePhotos').popover(
				{
					content: $('#photoWarning').html(),
					html: true,
					placement: 'right'
				}
			);
			
			
			$('#chkMapSearch').attr('checked', false);
			$('#chkMapSearch').click(function() {
				// TODO: Update the query to only return results within bounds of the map. 
			});

			// MASTER refresh of entities on the page. 
			// refresh entities at a regular interval
			// if we just refresh all displayed entities on each incoming tweet, the DOM is constantly updating making it difficult to click a link.
			setInterval(function() {
				if (stream.isSearching) {
					display.renderLinks(entities.links);
					display.renderHashtags(entities.hashtags);
					display.renderMentions(entities.mentions);
					if ($('#chkEnablePhotos').is(':checked')) { 
						display.renderPhotos(entities.photos);
						entities.photos.length = 0;  // Photos have been rendered, clear the queue. 
					};
					stream.checkHeartbeat();
				}
			}, 5000);

			// select a random marker on the map, just to keep it interesting
			// setInterval(loc.clickRandomMarker, 10000);			
		});
		
	})();

})(jQuery);


// ****** HELPER FUNCTIONS ******

// Build and display an alert
// Yes, I'm concatenating HTML here.
// Level can be: alert-error, alert-success, alert-info or null
function displayMessage(level, title, messages) {
	var msgs = '';
	for (var ii=0; ii<messages.length; ii++) {
		msgs += '<p>';
		if (messages[ii].date) msgs += '[' + moment(messages[ii].date).format('ddd h:mm:ss A') + '] ';
		msgs += messages[ii].msg + '</p>';
	}

	//$('#msgCenter').html('<div class="alert alert-block fade in ' + level + '"><button class="close" data-dismiss="alert" type="button">&times;</button><h4 class="alert-heading">' + title + '</h4>' + msgs);
	$('#msgCenter').html('<div class="alert alert-block fade in ' + level + '"><h4 class="alert-heading">' + title + '</h4>' + msgs);
/*			
	$('html, body').animate({
		scrollTop: $("#msgCenter").offset().top - 10
	}, 500);
*/
}


// Sort an array of objects by a particular field
// http://stackoverflow.com/questions/979256/how-to-sort-an-array-of-javascript-objects
function sort_by(field, reverse, primer){

   var key = function (x) {return primer ? primer(x[field]) : x[field]};

   return function (a,b) {
       var A = key(a), B = key(b);
       return (A < B ? -1 : (A > B ? 1 : 0)) * [1,-1][+!!reverse];                
   }
}


// Retreive a single value from the querystring. 
function getQuerystringValue(param) {
	var val;
	if (param && param.length > 0) {
		var vars = [], hash;
		var q = document.URL.split('?')[1];
		if(q != undefined) {
			q = q.split('&');
			for(var i = 0; i < q.length; i++) {
				hash = q[i].split('=');
				vars.push(hash[1]);
				vars[hash[0]] = hash[1];
			}
		}
		
		val = vars[param];		
	}
	
	return val;
}

// Retreive a single cookie value. 
function getCookieValue(param) {
	var val;
	if (param && param.length > 0) {
		var vars = [], hash;
		if(document.cookie != undefined) {
			cookies = document.cookie.split('; ');
			for(var i = 0; i < cookies.length; i++) {
				hash = cookies[i].split('=');
				vars.push(hash[1]);
				vars[hash[0]] = hash[1];
			}
		}
		
		val = vars[param];		
	}
	
	return val;
}


// ****** END HELPER FUNCTIONS ******