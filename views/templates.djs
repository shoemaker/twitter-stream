<script id="tweetTemplate" type="text/x-dot-template">
	{{? it}}
	<div class="media tweet">
		<a class="pull-left" href="http://twitter.com/{{=it.user.screen_name}}">
			<img class="media-object img-rounded" src="{{=it.user.profile_image_url}}" />
		</a>
		<div class="media-body">
			<div>
				<a href="http://twitter.com/{{=it.user.screen_name}}">
				<strong>{{? it.user.name}}{{=it.user.name}}{{?}}{{? !it.user.name}}{{=it.user.screen_name}}{{?}}</strong></a>
				<span>&rlm;</span>&nbsp;
				<small>{{? it.user.screen_name}}@{{=it.user.screen_name}}{{?}}</small>
				<span class="pull-right"></span>
			</div>
			<div>
				{{=it.html}}
			</div>
			<div>
				<small><a href="https://twitter.com/{{=it.user.screen_name}}/status/{{=it.id_str}}">{{=it.created_display_time}}</a></small>&nbsp;&nbsp;
				<span><a href="https://twitter.com/intent/retweet?tweet_id={{=it.id_str}}"><i class="icon-retweet"></i></a></span>&nbsp;&nbsp;
				<span><a href="https://twitter.com/intent/favorite?tweet_id={{=it.id_str}}"><i class="icon-star-empty"></i></a></span>
			</div>
		</div>
	</div>
	{{?}}
	
	{{? !it}}
		<p>
			Once the Twitter stream has started your timeline will begin streaming and tweets will appear here. 
			The stream is limited to your timeline, showing the tweets of those you follow on Twitter. 
			Metadata from the incoming tweets - links, @mentions, #hashtags and photos - will be extracted and compiled below. 
		</p>
		<p>
			A video demonstraring this project is available <a href="http://vimeo.com/69333667">here</a>. Here are a few example search streams to get you started:
			<ul>
				<li><a href="#" class="searchTerm ignore">work</a></li>
				<li><a href="#" class="searchTerm ignore">breakfast</a></li>
				<li><a href="#" class="searchTerm ignore">4sq</a></li>
				<li><a href="#" class="searchTerm ignore">NSA</a></li>
			</ul>
		</p>
	{{?}}
</script>

<script id="mapTweetTemplate" type="text/x-dot-template">
	{{? it}}
		<div class="tweet">
			{{? it.place}}
				<div><strong>{{=it.place.name}}</strong></div>
			{{?}}
			<div>
				<a href="http://twitter.com/{{=it.user.screen_name}}">
					<strong>{{? it.user.name}}{{=it.user.name}}{{?}}{{? !it.user.name}}{{=it.user.screen_name}}{{?}}</strong></a>
				&nbsp;
				<small>{{? it.user.screen_name}}@{{=it.user.screen_name}}{{?}}</small>
			</div>
			<div>{{=it.html}}</div>
			<div>
				<a href="http://twitter.com/{{=it.user.screen_name}}/status/{{=it.id_str}}"><small>View on Twitter</small></a>
			</div>
		</div>
	{{?}}
</script>

<script id="linkTemplate" type="text/x-dot-template">
	{{~it :l:index}}
		<p class="link">
			<a href="{{= l.item.expanded_url}}">{{= l.item.display_url}}</a> [{{= l.count}}]
		</p>
	{{~}}
	
	{{? !it[0]}}
		<p>
			Links embedded in tweets will be aggregated here, sorted by most popular. 
		</p>
	{{?}}
</script>

<script id="hashtagTemplate" type="text/x-dot-template">
	{{~it :h:index}}
		<span rel="{{=h.count}}" class="hashtag" data="{{=h.item.text}}">#{{=h.item.text}}</span> 
	{{~}}
	{{? !it[0]}}
		<p>
			Hashtags popular from your stream will be aggregated into a tag cloud. 
		<p>
	{{?}}
</script>

<script id="mentionTemplate" type="text/x-dot-template">
	{{~it :m:index}}
		<a href="http://twitter.com/{{=m.item.screen_name}}" rel="{{=m.count}}" class="mention">@{{=m.item.screen_name}}</a> 
	{{~}}
	{{? !it[0]}}
		<p>
			Users mentioned within tweets will be aggregated into a tag cloud. 
		</p>
	{{?}}
</script>

<script id="photoTemplate" type="text/x-dot-template">
	{{~it :p:index}}
		<li class="photo">
			<a href="{{=p.expanded_url}}">
				<img data-placement="top" data-toggle="tooltip" data-original-title="{{=p.display_url}}" src="{{=p.media_url}}:thumb" data-description="{{=p.display_url}}" />
			</a>
		</li>
	{{~}}
</script>