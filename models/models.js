exports.user = function() {
	var obj = {
		services : {
			twitter : {
				token: null,
				tokenSecret: null,
				username: null,
				avatarUrl: null,
				dateCreated : new Date()
			}
		}
	};
	
	return obj;
}