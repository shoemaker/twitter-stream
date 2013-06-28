<!DOCTYPE html>
<html>
	<head>
	    <meta charset="utf-8">
	    <title>Twitter Stream</title>
		<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
	    <!--<meta name="viewport" content="width=device-width, initial-scale=1.0">-->
	    <meta name="description" content="Twitter stream sandbox.">
	    <meta name="author" content="Brian Shoemaker">
		<link rel="stylesheet" href="/stream/css/bootstrap.min.css">
		<link rel="stylesheet" href="/stream/css/bootstrap-responsive.css">
		<link rel="stylesheet" href="/stream/css/style.css">
	    <!-- HTML5 shim, for IE6-8 support of HTML5 elements -->
	    <!--[if lt IE 9]>
	      <script src="http://html5shim.googlecode.com/svn/trunk/html5.js"></script>
	    <![endif]-->
	</head>
	<body>

		<div id="wrap">

			<div class="jumbotron masthead">
				<div class="container-fluid">
					<div class="row-fluid">
					
						<div class="span6" id="intro">
							<h3>
								<img src="/stream/img/twitter-bird-white-on-blue.png" />
								Twitter Stream
							</h3>
							Realtime Twitter search. Provide a search term and get a torrent of tweets, locations, photos, links, @mentions and #hashtags. 
						</div>
						<div class="span6" id="auth">
						{{#isAuthorized}}
							<h4>
								{{#user.services.twitter.avatarUrl}}
									<img src="{{user.services.twitter.avatarUrl}}" class="img-rounded" />
								{{/user.services.twitter.avatarUrl}}
								{{^user.services.twitter.avatarUrl}}
									<img src="{{user.profileImage}}&s=40" class="img-rounded" />
								{{/user.services.twitter.avatarUrl}}
							</h4>
							<h5>
								{{#user.services.twitter}}
									@{{user.services.twitter.username}} | <a href="/auth/twitter/logout" id="logout">Logout</a>
								{{/user.services.twitter}}
							</h5>
						{{/isAuthorized}}
						
						{{^isAuthorized}}
							<div id="authTwitter">
								{{^user.services.twitter}}
									<small><a href="/auth/twitter"><img src="/stream/img/sign-in-with-twitter-gray.png" /></a></small>
								{{/user.services.twitter}}
							</div>
						{{/isAuthorized}}
						</div>
						
					</div>
				</div>
			</div>


			<div class="container-fluid" style="margin-top:20px;">			
				{{#isAuthorized}}
				{{#isSuperUser}}
				<div class="row-fluid">
					<div class="span7" id="searchContainer">
						<div class="input-append">
							<input class="input-large" id="txtSearch" type="text" placeholder="Enter search term here">
						    <button class="btn btn-success" id="btnToggle" type="button"><i class="icon-play icon-white"></i> Start</button>
							<button class="btn" type="button" id="btnReset"><i class="icon-refresh"></i> Reset</button>
						</div>
						
					    <div>
						    <label class="checkbox inline" id="lblEnablePhotos" data-trigger="hover">
								<input type="checkbox" id="chkEnablePhotos" value="true" /> Enable photos?
							</label>
							<label class="checkbox inline" style="display:none;">
								<input type="checkbox" id="chkMapSearch" value="true" /> Limit search to map?
							</label>
							<span class="help-inline">
								<span id="tweetCount">0</span>
								<span id="tweetCountLabel">tweets</span>								
							</span>
						</div>	    					    
					</div>
					<div class="span5">
						<div id="msgCenter"></div>
					</div>
				</div>
				<div class="row-fluid">
					<div class="span7">
						<h4>Twitter Stream</h4>
						<div id="tweetContainer"><i class="icon-fire"></i> Loading...</div>
					</div>
					<div class="span5">
						<div id="map_canvas"></div>
					</div>
				</div>
				<div class="row-fluid" id="photoRow" style="display:none;">
					<div class="span12">
						<h4>Photos</h4>
						<div id="photoContainer">
							<ul></ul>
						</div>							
					</div>
				</div>
				<div class="row-fluid">
					<div class="span4">
						<h4>Links</h4>
						<div id="linkContainer"><i class="icon-fire"></i> Loading...</div>
					</div>
					<div class="span4">
						<h4>#Hashtags</h4>
						<div id="hashtagContainer"><i class="icon-fire"></i> Loading...</div>
					</div>
					<div class="span4">
						<h4>@Mentions</h4>
						<div id="mentionContainer"><i class="icon-fire"></i> Loading...</div>
					</div>
				</div>
				<div class="row-fluid">
					<div class="span12">
						<h3>Project Details</h3>
						{{> projectDetails}}
					</div>
				</div>
			{{/isSuperUser}}
			
			{{/isAuthorized}}
			
			
			{{^isSuperUser}}
				<div class="row-fluid">
					<div class="span6">
						<h4>Wait... what?</h4>
						<p>
							To see a search in action, check out the video. 
							The source code is available on <a href="https://github.com/shoemaker/stream">GitHub</a>. 
						</p>
						<p>
							The Twitter API <a href="https://dev.twitter.com/docs/streaming-apis/streams/public#Connections">terms of service</a> 
							allow only a single connection from each IP address to the public timeline. 
							This limitation prevents developers from writing hosted applications that open more than one connection to the public timeline, 
							which prevents me from opening the search to the public. 
							However, you're welcome to pull the source code from <a href="https://github.com/shoemaker/stream">GitHub</a> and run the project, with all the features, locally. 
						</p>
						<h4>Project Details</h4>
						{{> projectDetails}}
					</div>
					<div class="span6">
						<iframe src="http://player.vimeo.com/video/69333667" width="100%" height="313" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>
						<p>
							<img src="/stream/img/screenshot.png" />
						</p>
					</div>
				</div>
			{{/isSuperUser}}
			</div>
			
			<div id="push"></div>
		</div>

		<footer>
			<h4>
				Made by <a href="http://brianshoemaker.com" target="_blank">Brian Shoemaker</a>
			</h4>
			<p>
				Built with <a href="http://nodejs.org/" target="_blank">Node.js</a>, 
				<a href="http://www.socket.io" target="_blank">socket.io</a>, 
				<a href="http://olado.github.io/doT/" target="_blank">doT.js</a>, 
				<a href="https://developers.google.com/maps/" target="_blank">Google Maps</a> and 
				<a href="http://twitter.github.com/bootstrap/" target="_blank">Bootstrap</a>.
			</p>
		</footer>
		
		<div id="photoWarning" style="display:none">
			<i class="icon-warning-sign"></i>
			This could result in NSFW photos. 
		</div>
		
		<a href="https://github.com/shoemaker/stream"><img style="position: absolute; top: 0; right: 0; border: 0;" src="https://s3.amazonaws.com/github/ribbons/forkme_right_red_aa0000.png" alt="Fork me on GitHub"></a>
		
		{{#isSuperUser}}
		<script src="http://code.jquery.com/jquery-1.9.0.min.js"></script>
		<script src="/stream/socket.io/socket.io.js"></script>
		<script src="/stream/js/libs/bootstrap.min.js"></script>
		<script src="/stream/js/libs/doT.min.js"></script>
		<script src="/stream/js/libs/jquery.tagcloud.js"></script>
		<script src="/stream/js/libs/moment.js"></script>
		<script type="text/javascript" src="http://maps.googleapis.com/maps/api/js?key=AIzaSyANGgwB0MPT7XLpq8jyX6Z5mHhHRnHz8Vk&sensor=false"></script>
		<script type="text/javascript" src="/stream/js/script.js"></script>	
		{{/isSuperUser}}
	</body>
</html>

