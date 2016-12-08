(function(){
	
	$(returnme).click(function(){
     window.location.href = '/';
   });

	var button = document.getElementById('cn-button'),
    wrapper = document.getElementById('cn-wrapper'),
   map = document.getElementById('map'),
   genre = document.getElementById('genre'),
   emotion = document.getElementById('emotion'),
   create = document.getElementById('create');

	$(button).hover(
    	function() { $.data(this, 'hover', true); },
    	function() { $.data(this, 'hover', false); }
	).data('hover', false);
	
	$(map).hover(
    	function() { $.data(this, 'hover', true); },
    	function() { $.data(this, 'hover', false); }
	).data('hover', false);
	
	$(create).hover(
    	function() { $.data(this, 'hover', true); },
    	function() { $.data(this, 'hover', false); }
	).data('hover', false);
	
	$(emotion).hover(
    	function() { $.data(this, 'hover', true); },
    	function() { $.data(this, 'hover', false); }
	).data('hover', false);
	
	$(genre).hover(
    	function() { $.data(this, 'hover', true); },
    	function() { $.data(this, 'hover', false); }
	).data('hover', false);

	button.addEventListener('mouseover', handler, false);
	button.addEventListener('mouseleave', antihandler, false);
	map.addEventListener('mouseleave', antihandler, false);
	genre.addEventListener('mouseleave', antihandler, false);
	emotion.addEventListener('mouseleave', antihandler, false);
	create.addEventListener('mouseleave', antihandler, false);

	function handler(){
	    this.innerHTML = "Close";
	    classie.add(wrapper, 'opened-nav');
	}
	
	function antihandler(){
		window.setTimeout(function(){
			if(!$(map).data('hover') && !$(create).data('hover') && !$(genre).data('hover') && !$(emotion).data('hover') && !$(button).data('hover')){
	    button.innerHTML = "Menu";
		classie.remove(wrapper, 'opened-nav');
	  }}, 250);
	}

})();
