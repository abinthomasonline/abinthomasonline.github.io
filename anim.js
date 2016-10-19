$(document).ready(function() {
  $('i').hide();
})

$(window).load(function() {
  $('i').show();

  var twitterPos = $('#twitter').position();
  var githubPos = $('#github').position();
  var linkedinPos = $('#linkedin').position();
  var plusPos = $('#plus').position();
  var mailPos = $('#mail').position();
  var imgPos = $('.me').position();
  
  $('i').css({
    position: 'absolute',
    zIndex: '1',
    top: imgPos.top + 100,
    left: '47%'
  });
  
  setTimeout(function() {
    $('#twitter').animate({
      top: twitterPos.top + 10,
      left: twitterPos.left - 10
    }, 500);
  }, 250);
  
  setTimeout(function() {
    $('#twitter').animate({
      top: twitterPos.top,
      left: twitterPos.left
    }, 250);
    
    $('#github').animate({
      top: githubPos.top + 10,
      left: githubPos.left - 6
    }, 500);
  }, 500);
  
  setTimeout(function() {
    $('#github').animate({
      top: githubPos.top,
      left: githubPos.left
    }, 250);
    
    $('#linkedin').animate({
      top: linkedinPos.top + 10,
      left: linkedinPos.left - 3
    }, 500);
  }, 750);
  
  setTimeout(function() {
    $('#linkedin').animate({
      top: linkedinPos.top,
      left: linkedinPos.left
    }, 250);
    
    $('#plus').animate({
      top: plusPos.top + 10,
      left: plusPos.left
    }, 500);
  }, 1000);
  
  setTimeout(function() {
    $('#plus').animate({
      top: plusPos.top,
      left: plusPos.left
    }, 250);
    
    $('#mail').animate({
      top: mailPos.top + 10,
      left: mailPos.left + 3
    }, 500);
  }, 1250);
  
  setTimeout(function() {
    $('#mail').animate({
      top: mailPos.top,
      left: mailPos.left
    }, 250);
  }, 1500);
  
})