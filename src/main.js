/**
	Winter Rush Main
	Handles input, sounds, renderer, resize, score display
	by Felix Turner / @felixturner / www.airtight.cc
**/

//Global Config
var WRConfig = {
	
	//debug toggles
	playSound:true,
	playMusic:true,
	hitDetect:true,
	showDebug:true,

	//const dimensions
	FLOOR_WIDTH: 3600, 	// size of floor in x direction
	FLOOR_DEPTH: 7200, 	//size of floor in z direction
	MOVE_STEP: 500 			//z distance to move before recreating a new floor strip

};

var WRMain = function() {

		var camera, scene, renderer;
	
		//FX
		var composer;
		var superPass;
		var hueTime = 0;
		
		var fxParams = {
			vignetteAmount:0.8,
			brightness:0,
			saturation: 0.5,
			};

	var hiScore = 0;
	var score = 0;

	var sndPickup;
	var sndCollide;
	var sndMusic;
	
	var lastEvent;
	var stats;
	var splashSize;
	
	var bkgndColor = 0x061837;
	var isMobile = false;

	var splashMode = 0; //0->2 indicating which splash page is showing
	var isFirstGame = true;
	
	function init() {		//初始化内容，包括载入声音，图片文件变量，设置摄像机和场景的一些shader和render

		WRConfig.showDebug = window.location.href.indexOf("?dev")  > -1;

		if (WRConfig.showDebug){
			stats = new Stats();
			stats.domElement.style.position = 'absolute';
			stats.domElement.style.top = '0px';
			stats.domElement.style.left = '0px';
			$("#container").append( stats.domElement );
		}

		isMobile = !!('ontouchstart' in window); //true for android or ios, false for MS surface

		if (isMobile){
			$("#prompt-small").text("Tap to move left or right");
			$("#info").html("Built with Love by <a href='http://www.airtight.cc'>Airtight</a>.");
		}

		//INIT CONTROLS
		$("#container").on( 'touchstart', onTouchStart, false );
		$("#container").on( 'touchend', onTouchEnd, false );

		$(document).on('keydown', onKeyDown, false);
		$(document).on('keyup', onKeyUp, false);
		$("#splash").on('mousedown', onMouseDown, false);
		$("#splash").on('tap', onMouseDown, false);

		// if (window.DeviceOrientationEvent) {
		// 	window.addEventListener('deviceorientation', deviceOrientationHandler, false);
		// }

		//init audio
		if (WRConfig.playSound){
			sndPickup = new Howl( {src: ["res/audio/point.mp3"]}); 
			sndCollide = new Howl({ src: ["res/audio/hit.mp3"]}); 
			sndBest = new Howl( {src: ["res/audio/best.mp3"]}); 
		}

		if (WRConfig.playMusic){
			sndMusic = new Howl( {src: ["res/audio/Jingle Bell.mp3"],loop: true}); 
			$("#music-toggle").on("click",toggleMusic);
			$("#music-toggle").on("tap",toggleMusic);
		}

		//init 3D

		var size = 800;
		camera = new THREE.PerspectiveCamera( 75, 8 / 6, 1, 10000 );
		camera.position.z = WRConfig.FLOOR_DEPTH/2 - 300;

		scene = new THREE.Scene();
		scene.fog = new THREE.Fog( bkgndColor, WRConfig.FLOOR_DEPTH-560, WRConfig.FLOOR_DEPTH );

		renderer = new THREE.WebGLRenderer();
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.setClearColor( bkgndColor, 0.5 );
		$("#container").append( renderer.domElement );

		//FX	一些shader和renderer
		var renderPass = new THREE.RenderPass( scene, camera );		
		superPass = new THREE.ShaderPass(THREE.SuperShader);

		superPass.uniforms.vigDarkness.value = 2;
		superPass.uniforms.vigOffset.value =  fxParams.vignetteAmount;
		superPass.uniforms.saturation.value =  fxParams.saturation -1;

		composer = new THREE.EffectComposer( renderer );		//1）创建一个EffectComposer（效果组合器）对象，然后在该对象上添加后期处理通道。
																//2）配置该对象，使它可以渲染我们的场景，并应用额外的后期处理步骤。
    															//3）在render循环中，使用EffectComposer渲染场景、应用通道，并输出结果。
		composer.addPass( renderPass );
		composer.addPass( superPass );
		superPass.renderToScreen = true;					//将结果输出到屏幕上的通道

		WRGame.init();

		resize();

		animate();

		//fade in
		TweenMax.fromTo(fxParams , 1, {brightness: -1},{brightness:0,delay:0.5});
		TweenMax.fromTo($('#splash') , 1, {autoAlpha: 0},{autoAlpha: 1,delay:1});
		TweenMax.fromTo($('#info') , 1, {autoAlpha: 0},{autoAlpha: 1,delay:1});
		TweenMax.fromTo($('#music-toggle') , 1, {autoAlpha: 0},{autoAlpha: 1,delay:1});

		$("#preloader").css("display","none");

		//preload splash page images
		var img1 = new Image();
		img1.src = "res/img/xmas-splash.png";
		var img2 = new Image();
		img2.src = "res/img/xmas-best.png";
		var img3 = new Image();
		img3.src = "res/img/xmas-wipeout.png";

	}

	function toggleMusic(){

		$(this).toggleClass("off");

		if($(this).hasClass("off")){
			sndMusic.mute();
		}else{
			sndMusic.unmute();
		}

	}

	$(window).resize(function() {
		resize();
	});

	function resize(){			//设置页面大小

		var w = window.innerWidth; 
		var h = window.innerHeight;

		//handle retina screens
		// var dpr = 1;
		// if (window.devicePixelRatio !== undefined) {
		// 	dpr = window.devicePixelRatio;
		// }

		composer.setSize(w , h );
		renderer.setSize(w, h);
		camera.aspect = w / h;

		//scale to fit and center splash
		splashSize = Math.min(w,h)*0.85;
		splashSize = Math.min(splashSize,500);

		$("#splash").css("width", splashSize + "px");
		$("#splash").css("height", splashSize+ "px");

		$("#splash").css("left",(w - splashSize)/2 + "px");
		$("#splash").css("top",(h - splashSize)/2 + "px");

		//splash page resizing
		if (splashMode === 0){
			if (isMobile){
				$('#prompt-big').css("font-size" , splashSize * 0.05 + "px");
				$('#prompt-small').css("font-size" , splashSize * 0.06 + "px");
			}else{
				$('#prompt-big').css("font-size" , splashSize * 0.06 + "px");
				$('#prompt-small').css("font-size" , splashSize * 0.04 + "px");

			}
		}else if(splashMode == 1){
			$('#prompt-big').css("font-size" , splashSize * 0.09 + "px");
		}else{
			$('#prompt-big').css("font-size" , splashSize * 0.08 + "px");
			$('#prompt-small').css("font-size" , splashSize * 0.04 + "px");
		}

	}

	function playCollide(){		//发生碰撞时播放碰撞声音
		if (WRConfig.playSound) 
			{sndCollide.play();}
	}

	function onScorePoint(){	//得分时播放声音，分数加一
		if (WRConfig.playSound) sndPickup.play();
		score += 1;
		$("#score-text").text(score);
		TweenMax.fromTo($('#score-text') , 0.4, {scale: 2},{scale: 1,ease:Bounce.easeOut});	//得分显示的动画效果，弹一下

		if (score === hiScore + 1 && hiScore !== 0){	//===恒等，超过最高分的时候播放一次最高分音效
			if (WRConfig.playSound) sndBest.play();
		}
	}

	function onGameOver(){	//游戏结束时画面图案的弹出效果

		if (WRConfig.playSound) sndCollide.play();

		//display score
		TweenMax.to($('#score-text') , 0.1, {autoAlpha: 0});
		TweenMax.fromTo($('#splash') , 0.5, {scale: 0.6,autoAlpha: 0},{scale: 1,autoAlpha: 1,ease:Expo.easeOut});
		TweenMax.fromTo($('#info') , 0.5, {autoAlpha: 0},{autoAlpha: 1});
		TweenMax.fromTo($('#music-toggle') , 0.5, {autoAlpha: 0},{autoAlpha: 1});

		if (score > hiScore){
			splashMode = 1;
			hiScore = score;
			$('#splash').css('background-image', 'url(res/img/xmas-best.png)');		//最高分的图案
			$('#prompt-big').text("分数: " + score);
			$('#prompt-small').css('display','none');
			$('#prompt-big').css("margin-top" , "10%");

		}else{
			splashMode = 2;
			$('#splash').css('background-image', 'url(res/img/xmas-wipeout.png)');	//wipeout图案
			$('#prompt-big').text("分数: " + score);
			$('#prompt-small').text("最高分: " + hiScore);
			$('#prompt-small').css('display','block');
			$('#prompt-big').css("margin-top" , "8%");
			$('#prompt-small').css("margin-top" , "2%");
		 }

		resize();
		hueTime =0;

	}

	function onGameStart(){		//游戏开始时，各图案变小消失的动画效果。 得分的显示
		TweenMax.to($('#splash') , 0.3, {autoAlpha: 0});
		TweenMax.to($('#info') , 0.3, {autoAlpha: 0});
		TweenMax.to($('#music-toggle') , 0.3, {autoAlpha: 0});
		TweenMax.to($('#score-text') , 0.3, {autoAlpha: 1,delay:0.3});
		score = 0;
		$("#score-text").text(score);

		if (isFirstGame && WRConfig.playMusic ) sndMusic.play();						

		WRGame.startGame(isFirstGame);
		isFirstGame = false;
	}

	function animate(){

		requestAnimationFrame( animate );	//定时器，把每一帧中的所有DOM操作集中起来，在一次重绘或回流中就完成，并且重绘或回流的时间间隔紧紧跟随浏览器的刷新频率
		WRGame.animate();
		if (WRConfig.showDebug){
			stats.update();
		}
		
		//faster = more hue amount and faster shifts
		var hueAmount;
		if (WRGame.getSpeed() < 0.5){
			hueAmount = 0;
		}else{
			hueAmount = (WRGame.getSpeed()- 0.5) * 2;
		}
		superPass.uniforms.hueAmount.value =  hueAmount;

		hueTime += WRGame.getSpeed() * WRGame.getSpeed() * 0.05;
		var hue = hueTime % 2 - 1; 			//put in range -1 to 1
		superPass.uniforms.hue.value =  hue;
		superPass.uniforms.brightness.value =  fxParams.brightness;
		composer.render( 0.1 );
		
		//WRMain.trace( WRGame.getSpeed());

	}

	//INPUT HANDLERS
	
	function onTouchStart( event ) {

		if (!WRGame.getPlaying() && WRGame.getAcceptInput()){
			onGameStart();
		}

		for(  var i = 0; i <  event.touches.length; i++) {

			event.preventDefault();

			var xpos = event.touches[ i ].pageX;

			if (xpos > window.innerWidth / 2){
				WRGame.setRightDown(true);
			}else{
				WRGame.setLeftDown(true);
			}
		}
	}

	function onTouchEnd( event ) {

		for(  var i = 0; i <  event.changedTouches.length; i++) {

			event.preventDefault();
			var xpos = event.changedTouches[ i ].pageX;

			if (xpos > window.innerWidth / 2){
				WRGame.setRightDown(false);
			}else{
				WRGame.setLeftDown( false);
			}
		}
	}
	
	function onKeyUp( event ) {

		lastEvent = null;

		switch ( event.keyCode ) {
			case 39: /* RIGHT */
				WRGame.setRightDown(false);
				break;
			case 37: /* LEFT */
				WRGame.setLeftDown(false);					
				break;
				
			case 38: /* UP */					/////////~~~~~~~~~~~增加5
				WRGame.setUPDown(false);
				break;
			case 40: /* DOWN */
				WRGame.setDOWNDown(false);
				break;
			
		}

		//endSlide();
	}

	function onKeyDown(event) {

		if (lastEvent && lastEvent.keyCode == event.keyCode) {
			return;
		}

		lastEvent = event;

		if (!WRGame.getPlaying() && WRGame.getAcceptInput()){
			onGameStart();
		}
		
		switch ( event.keyCode ) {
			case 39: /* RIGHT */
				WRGame.setRightDown(true);
				break;
			case 37: /* LEFT */
				WRGame.setLeftDown( true);
				break;
				
			case 38: /* UP */					/////////~~~~~~~~~~~增加1
				WRGame.setUPDown(true);
				break;
			case 40: /* DOWN */
				WRGame.setDOWNDown(true);
				break;
			
		}
	}

	function onMouseDown(){

		if (!WRGame.getPlaying()){
			onGameStart();
		}
	}

	function trace(text){
		if (WRConfig.showDebug){
			$("#debug-text").text(text);
		}
	}

	// function deviceOrientationHandler(eventData) {
	// 	if (eventData.beta === null) return;
	// 	var cuttoff = 5;
	// 	var tiltedRight = eventData.beta > cuttoff;
	// 	var tiltedLeft = eventData.beta < -cuttoff;
	// 	WRGame.setRightDown(tiltedRight);
	// 	WRGame.setLeftDown(tiltedLeft);
	// }

	return {
		init:init,
		trace: trace,
		onGameOver:onGameOver,
		onScorePoint: onScorePoint,
		getScene:function (){return scene;},
		getCamera:function (){return camera;},
		playCollide:playCollide,
		fxParams:fxParams,
	};


}();


$(document).ready(function() {
	WRMain.init();
});
