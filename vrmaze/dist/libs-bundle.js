/**
 * @author richt / http://richt.me
 * @author WestLangley / http://github.com/WestLangley
 *
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */

THREE.DeviceOrientationControls = function( object ) {

	var scope = this;

	this.object = object;
	this.object.rotation.reorder( "YXZ" );

	this.enabled = true;

	this.deviceOrientation = {};
	this.screenOrientation = 0;

	this.alpha = 0;
	this.alphaOffsetAngle = 0;


	var onDeviceOrientationChangeEvent = function( event ) {

		scope.deviceOrientation = event;

	};

	var onScreenOrientationChangeEvent = function() {

		scope.screenOrientation = window.orientation || 0;

	};

	// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

	var setObjectQuaternion = function() {

		var zee = new THREE.Vector3( 0, 0, 1 );

		var euler = new THREE.Euler();

		var q0 = new THREE.Quaternion();

		var q1 = new THREE.Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

		return function( quaternion, alpha, beta, gamma, orient ) {

			euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

			quaternion.setFromEuler( euler ); // orient the device

			quaternion.multiply( q1 ); // camera looks out the back of the device, not the top

			quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation

		}

	}();

	this.connect = function() {

		onScreenOrientationChangeEvent(); // run once on load

		window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = true;

	};

	this.disconnect = function() {

		window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = false;

	};

	this.update = function() {

		if ( scope.enabled === false ) return;

		var alpha = scope.deviceOrientation.alpha ? THREE.Math.degToRad( scope.deviceOrientation.alpha ) + this.alphaOffsetAngle : 0; // Z
		var beta = scope.deviceOrientation.beta ? THREE.Math.degToRad( scope.deviceOrientation.beta ) : 0; // X'
		var gamma = scope.deviceOrientation.gamma ? THREE.Math.degToRad( scope.deviceOrientation.gamma ) : 0; // Y''
		var orient = scope.screenOrientation ? THREE.Math.degToRad( scope.screenOrientation ) : 0; // O

		setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );
		this.alpha = alpha;

	};

	this.updateAlphaOffsetAngle = function( angle ) {

		this.alphaOffsetAngle = angle;
		this.update();

	};

	this.dispose = function() {

		this.disconnect();

	};

	this.connect();

};
/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */
/*global THREE, console */

// This set of controls performs orbiting, dollying (zooming), and panning. It maintains
// the "up" direction as +Y, unlike the TrackballControls. Touch on tablet and phones is
// supported.
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finter swipe
//
// This is a drop-in replacement for (most) TrackballControls used in examples.
// That is, include this js file and wherever you see:
//    	controls = new THREE.TrackballControls( camera );
//      controls.target.z = 150;
// Simple substitute "OrbitControls" and the control should work as-is.

THREE.OrbitControls = function ( object, domElement ) {

    this.object = object;
    this.domElement = ( domElement !== undefined ) ? domElement : document;

    // API

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the control orbits around
    // and where it pans with respect to.
    this.target = new THREE.Vector3();
    // center is old, deprecated; use "target" instead
    this.center = this.target;

    // This option actually enables dollying in and out; left as "zoom" for
    // backwards compatibility
    this.noZoom = false;
    this.zoomSpeed = 1.0;
    // Limits to how far you can dolly in and out
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // Set to true to disable this control
    this.noRotate = false;
    this.rotateSpeed = 1.0;

    // Set to true to disable this control
    this.noPan = false;
    this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // Set to true to disable use of the keys
    this.noKeys = false;
    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    ////////////
    // internals

    var scope = this;

    var EPS = 0.000001;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    var phiDelta = 0;
    var thetaDelta = 0;
    var scale = 1;
    var pan = new THREE.Vector3();

    var lastPosition = new THREE.Vector3();

    var STATE = { NONE : -1, ROTATE : 0, DOLLY : 1, PAN : 2, TOUCH_ROTATE : 3, TOUCH_DOLLY : 4, TOUCH_PAN : 5 };
    var state = STATE.NONE;

    // events

    var changeEvent = { type: 'change' };


    this.rotateLeft = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        thetaDelta -= angle;

    };

    this.rotateUp = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        phiDelta -= angle;

    };

    // pass in distance in world space to move left
    this.panLeft = function ( distance ) {

        var panOffset = new THREE.Vector3();
        var te = this.object.matrix.elements;
        // get X column of matrix
        panOffset.set( te[0], te[1], te[2] );
        panOffset.multiplyScalar(-distance);

        pan.add( panOffset );

    };

    // pass in distance in world space to move up
    this.panUp = function ( distance ) {

        var panOffset = new THREE.Vector3();
        var te = this.object.matrix.elements;
        // get Y column of matrix
        panOffset.set( te[4], te[5], te[6] );
        panOffset.multiplyScalar(distance);

        pan.add( panOffset );
    };

    // main entry point; pass in Vector2 of change desired in pixel space,
    // right and down are positive
    this.pan = function ( delta ) {

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        if ( scope.object.fov !== undefined ) {

            // perspective
            var position = scope.object.position;
            var offset = position.clone().sub( scope.target );
            var targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan( (scope.object.fov/2) * Math.PI / 180.0 );
            // we actually don't use screenWidth, since perspective camera is fixed to screen height
            scope.panLeft( 2 * delta.x * targetDistance / element.clientHeight );
            scope.panUp( 2 * delta.y * targetDistance / element.clientHeight );

        } else if ( scope.object.top !== undefined ) {

            // orthographic
            scope.panLeft( delta.x * (scope.object.right - scope.object.left) / element.clientWidth );
            scope.panUp( delta.y * (scope.object.top - scope.object.bottom) / element.clientHeight );

        } else {

            // camera neither orthographic or perspective - warn user
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );

        }

    };

    this.dollyIn = function ( dollyScale ) {

        if ( dollyScale === undefined ) {

            dollyScale = getZoomScale();

        }

        scale /= dollyScale;

    };

    this.dollyOut = function ( dollyScale ) {

        if ( dollyScale === undefined ) {

            dollyScale = getZoomScale();

        }

        scale *= dollyScale;

    };

    this.update = function () {

        var position = this.object.position;
        var offset = position.clone().sub( this.target );

        // angle from z-axis around y-axis

        var theta = Math.atan2( offset.x, offset.z );

        // angle from y-axis

        var phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );

        if ( this.autoRotate ) {

            this.rotateLeft( getAutoRotationAngle() );

        }

        theta += thetaDelta;
        phi += phiDelta;

        // restrict phi to be between desired limits
        phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );

        // restrict phi to be betwee EPS and PI-EPS
        phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );

        var radius = offset.length() * scale;

        // restrict radius to be between desired limits
        radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );

        // move target to panned location
        this.target.add( pan );

        offset.x = radius * Math.sin( phi ) * Math.sin( theta );
        offset.y = radius * Math.cos( phi );
        offset.z = radius * Math.sin( phi ) * Math.cos( theta );

        position.copy( this.target ).add( offset );

        this.object.lookAt( this.target );

        thetaDelta = 0;
        phiDelta = 0;
        scale = 1;
        pan.set(0,0,0);

        if ( lastPosition.distanceTo( this.object.position ) > 0 ) {

            this.dispatchEvent( changeEvent );

            lastPosition.copy( this.object.position );

        }

    };


    function getAutoRotationAngle() {

        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

    }

    function getZoomScale() {

        return Math.pow( 0.95, scope.zoomSpeed );

    }

    function onMouseDown( event ) {

        if ( scope.enabled === false ) { return; }
        event.preventDefault();

        if ( event.button === 0 ) {
            if ( scope.noRotate === true ) { return; }

            state = STATE.ROTATE;

            rotateStart.set( event.clientX, event.clientY );

        } else if ( event.button === 1 ) {
            if ( scope.noZoom === true ) { return; }

            state = STATE.DOLLY;

            dollyStart.set( event.clientX, event.clientY );

        } else if ( event.button === 2 ) {
            if ( scope.noPan === true ) { return; }

            state = STATE.PAN;

            panStart.set( event.clientX, event.clientY );

        }

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        scope.domElement.addEventListener( 'mousemove', onMouseMove, false );
        scope.domElement.addEventListener( 'mouseup', onMouseUp, false );

    }

    function onMouseMove( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        if ( state === STATE.ROTATE ) {

            if ( scope.noRotate === true ) return;

            rotateEnd.set( event.clientX, event.clientY );
            rotateDelta.subVectors( rotateEnd, rotateStart );

            // rotating across whole screen goes 360 degrees around
            scope.rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );
            // rotating up and down along whole screen attempts to go 360, but limited to 180
            scope.rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

            rotateStart.copy( rotateEnd );

        } else if ( state === STATE.DOLLY ) {

            if ( scope.noZoom === true ) return;

            dollyEnd.set( event.clientX, event.clientY );
            dollyDelta.subVectors( dollyEnd, dollyStart );

            if ( dollyDelta.y > 0 ) {

                scope.dollyIn();

            } else {

                scope.dollyOut();

            }

            dollyStart.copy( dollyEnd );

        } else if ( state === STATE.PAN ) {

            if ( scope.noPan === true ) return;

            panEnd.set( event.clientX, event.clientY );
            panDelta.subVectors( panEnd, panStart );

            scope.pan( panDelta );

            panStart.copy( panEnd );

        }

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        scope.update();

    }

    function onMouseUp( /* event */ ) {

        if ( scope.enabled === false ) return;

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        scope.domElement.removeEventListener( 'mousemove', onMouseMove, false );
        scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );

        state = STATE.NONE;

    }

    function onMouseWheel( event ) {

        if ( scope.enabled === false || scope.noZoom === true ) return;

        var delta = 0;

        if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

            delta = event.wheelDelta;

        } else if ( event.detail ) { // Firefox

            delta = - event.detail;

        }

        if ( delta > 0 ) {

            scope.dollyOut();

        } else {

            scope.dollyIn();

        }

    }

    function onKeyDown( event ) {

        if ( scope.enabled === false ) { return; }
        if ( scope.noKeys === true ) { return; }
        if ( scope.noPan === true ) { return; }

        // pan a pixel - I guess for precise positioning?
        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        var needUpdate = false;

        switch ( event.keyCode ) {

            case scope.keys.UP:
                scope.pan( new THREE.Vector2( 0, scope.keyPanSpeed ) );
                needUpdate = true;
                break;
            case scope.keys.BOTTOM:
                scope.pan( new THREE.Vector2( 0, -scope.keyPanSpeed ) );
                needUpdate = true;
                break;
            case scope.keys.LEFT:
                scope.pan( new THREE.Vector2( scope.keyPanSpeed, 0 ) );
                needUpdate = true;
                break;
            case scope.keys.RIGHT:
                scope.pan( new THREE.Vector2( -scope.keyPanSpeed, 0 ) );
                needUpdate = true;
                break;
        }

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        if ( needUpdate ) {

            scope.update();

        }

    }

    function touchstart( event ) {

        if ( scope.enabled === false ) { return; }

        switch ( event.touches.length ) {

            case 1:	// one-fingered touch: rotate
                if ( scope.noRotate === true ) { return; }

                state = STATE.TOUCH_ROTATE;

                rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                break;

            case 2:	// two-fingered touch: dolly
                if ( scope.noZoom === true ) { return; }

                state = STATE.TOUCH_DOLLY;

                var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
                var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
                var distance = Math.sqrt( dx * dx + dy * dy );
                dollyStart.set( 0, distance );
                break;

            case 3: // three-fingered touch: pan
                if ( scope.noPan === true ) { return; }

                state = STATE.TOUCH_PAN;

                panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                break;

            default:
                state = STATE.NONE;

        }
    }

    function touchmove( event ) {

        if ( scope.enabled === false ) { return; }

        event.preventDefault();
        event.stopPropagation();

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        switch ( event.touches.length ) {

            case 1: // one-fingered touch: rotate
                if ( scope.noRotate === true ) { return; }
                if ( state !== STATE.TOUCH_ROTATE ) { return; }

                rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                rotateDelta.subVectors( rotateEnd, rotateStart );

                // rotating across whole screen goes 360 degrees around
                scope.rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );
                // rotating up and down along whole screen attempts to go 360, but limited to 180
                scope.rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

                rotateStart.copy( rotateEnd );
                break;

            case 2: // two-fingered touch: dolly
                if ( scope.noZoom === true ) { return; }
                if ( state !== STATE.TOUCH_DOLLY ) { return; }

                var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
                var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
                var distance = Math.sqrt( dx * dx + dy * dy );

                dollyEnd.set( 0, distance );
                dollyDelta.subVectors( dollyEnd, dollyStart );

                if ( dollyDelta.y > 0 ) {

                    scope.dollyOut();

                } else {

                    scope.dollyIn();

                }

                dollyStart.copy( dollyEnd );
                break;

            case 3: // three-fingered touch: pan
                if ( scope.noPan === true ) { return; }
                if ( state !== STATE.TOUCH_PAN ) { return; }

                panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                panDelta.subVectors( panEnd, panStart );

                scope.pan( panDelta );

                panStart.copy( panEnd );
                break;

            default:
                state = STATE.NONE;

        }

    }

    function touchend( /* event */ ) {

        if ( scope.enabled === false ) { return; }

        state = STATE.NONE;
    }

    this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
    this.domElement.addEventListener( 'mousedown', onMouseDown, false );
    this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

    this.domElement.addEventListener( 'keydown', onKeyDown, false );

    this.domElement.addEventListener( 'touchstart', touchstart, false );
    this.domElement.addEventListener( 'touchend', touchend, false );
    this.domElement.addEventListener( 'touchmove', touchmove, false );

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );// stats.js - http://github.com/mrdoob/stats.js
var Stats=function(){var l=Date.now(),m=l,g=0,n=Infinity,o=0,h=0,p=Infinity,q=0,r=0,s=0,f=document.createElement("div");f.id="stats";f.addEventListener("mousedown",function(b){b.preventDefault();t(++s%2)},!1);f.style.cssText="width:80px;opacity:0.9;cursor:pointer";var a=document.createElement("div");a.id="fps";a.style.cssText="padding:0 0 3px 3px;text-align:left;background-color:#002";f.appendChild(a);var i=document.createElement("div");i.id="fpsText";i.style.cssText="color:#0ff;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px";
    i.innerHTML="FPS";a.appendChild(i);var c=document.createElement("div");c.id="fpsGraph";c.style.cssText="position:relative;width:74px;height:30px;background-color:#0ff";for(a.appendChild(c);74>c.children.length;){var j=document.createElement("span");j.style.cssText="width:1px;height:30px;float:left;background-color:#113";c.appendChild(j)}var d=document.createElement("div");d.id="ms";d.style.cssText="padding:0 0 3px 3px;text-align:left;background-color:#020;display:none";f.appendChild(d);var k=document.createElement("div");
    k.id="msText";k.style.cssText="color:#0f0;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px";k.innerHTML="MS";d.appendChild(k);var e=document.createElement("div");e.id="msGraph";e.style.cssText="position:relative;width:74px;height:30px;background-color:#0f0";for(d.appendChild(e);74>e.children.length;)j=document.createElement("span"),j.style.cssText="width:1px;height:30px;float:left;background-color:#131",e.appendChild(j);var t=function(b){s=b;switch(s){case 0:a.style.display=
        "block";d.style.display="none";break;case 1:a.style.display="none",d.style.display="block"}};return{REVISION:11,domElement:f,setMode:t,begin:function(){l=Date.now()},end:function(){var b=Date.now();g=b-l;n=Math.min(n,g);o=Math.max(o,g);k.textContent=g+" MS ("+n+"-"+o+")";var a=Math.min(30,30-30*(g/200));e.appendChild(e.firstChild).style.height=a+"px";r++;b>m+1E3&&(h=Math.round(1E3*r/(b-m)),p=Math.min(p,h),q=Math.max(q,h),i.textContent=h+" FPS ("+p+"-"+q+")",a=Math.min(30,30-30*(h/100)),c.appendChild(c.firstChild).style.height=
        a+"px",m=b,r=0);return b},update:function(){l=this.end()}}};/**
 * @author richt / http://richt.me
 * @author WestLangley / http://github.com/WestLangley
 *
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */

THREE.DeviceOrientationControls = function( object ) {

	var scope = this;

	this.object = object;
	this.object.rotation.reorder( "YXZ" );

	this.enabled = true;

	this.deviceOrientation = {};
	this.screenOrientation = 0;

	this.alpha = 0;
	this.alphaOffsetAngle = 0;


	var onDeviceOrientationChangeEvent = function( event ) {

		scope.deviceOrientation = event;

	};

	var onScreenOrientationChangeEvent = function() {

		scope.screenOrientation = window.orientation || 0;

	};

	// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

	var setObjectQuaternion = function() {

		var zee = new THREE.Vector3( 0, 0, 1 );

		var euler = new THREE.Euler();

		var q0 = new THREE.Quaternion();

		var q1 = new THREE.Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

		return function( quaternion, alpha, beta, gamma, orient ) {

			euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

			quaternion.setFromEuler( euler ); // orient the device

			quaternion.multiply( q1 ); // camera looks out the back of the device, not the top

			quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation

		}

	}();

	this.connect = function() {

		onScreenOrientationChangeEvent(); // run once on load

		window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = true;

	};

	this.disconnect = function() {

		window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = false;

	};

	this.update = function() {

		if ( scope.enabled === false ) return;

		var alpha = scope.deviceOrientation.alpha ? THREE.Math.degToRad( scope.deviceOrientation.alpha ) + this.alphaOffsetAngle : 0; // Z
		var beta = scope.deviceOrientation.beta ? THREE.Math.degToRad( scope.deviceOrientation.beta ) : 0; // X'
		var gamma = scope.deviceOrientation.gamma ? THREE.Math.degToRad( scope.deviceOrientation.gamma ) : 0; // Y''
		var orient = scope.screenOrientation ? THREE.Math.degToRad( scope.screenOrientation ) : 0; // O

		setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );
		this.alpha = alpha;

	};

	this.updateAlphaOffsetAngle = function( angle ) {

		this.alphaOffsetAngle = angle;
		this.update();

	};

	this.dispose = function() {

		this.disconnect();

	};

	this.connect();

};
/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */
/*global THREE, console */

// This set of controls performs orbiting, dollying (zooming), and panning. It maintains
// the "up" direction as +Y, unlike the TrackballControls. Touch on tablet and phones is
// supported.
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finter swipe
//
// This is a drop-in replacement for (most) TrackballControls used in examples.
// That is, include this js file and wherever you see:
//    	controls = new THREE.TrackballControls( camera );
//      controls.target.z = 150;
// Simple substitute "OrbitControls" and the control should work as-is.

THREE.OrbitControls = function ( object, domElement ) {

    this.object = object;
    this.domElement = ( domElement !== undefined ) ? domElement : document;

    // API

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the control orbits around
    // and where it pans with respect to.
    this.target = new THREE.Vector3();
    // center is old, deprecated; use "target" instead
    this.center = this.target;

    // This option actually enables dollying in and out; left as "zoom" for
    // backwards compatibility
    this.noZoom = false;
    this.zoomSpeed = 1.0;
    // Limits to how far you can dolly in and out
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // Set to true to disable this control
    this.noRotate = false;
    this.rotateSpeed = 1.0;

    // Set to true to disable this control
    this.noPan = false;
    this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // Set to true to disable use of the keys
    this.noKeys = false;
    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    ////////////
    // internals

    var scope = this;

    var EPS = 0.000001;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    var phiDelta = 0;
    var thetaDelta = 0;
    var scale = 1;
    var pan = new THREE.Vector3();

    var lastPosition = new THREE.Vector3();

    var STATE = { NONE : -1, ROTATE : 0, DOLLY : 1, PAN : 2, TOUCH_ROTATE : 3, TOUCH_DOLLY : 4, TOUCH_PAN : 5 };
    var state = STATE.NONE;

    // events

    var changeEvent = { type: 'change' };


    this.rotateLeft = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        thetaDelta -= angle;

    };

    this.rotateUp = function ( angle ) {

        if ( angle === undefined ) {

            angle = getAutoRotationAngle();

        }

        phiDelta -= angle;

    };

    // pass in distance in world space to move left
    this.panLeft = function ( distance ) {

        var panOffset = new THREE.Vector3();
        var te = this.object.matrix.elements;
        // get X column of matrix
        panOffset.set( te[0], te[1], te[2] );
        panOffset.multiplyScalar(-distance);

        pan.add( panOffset );

    };

    // pass in distance in world space to move up
    this.panUp = function ( distance ) {

        var panOffset = new THREE.Vector3();
        var te = this.object.matrix.elements;
        // get Y column of matrix
        panOffset.set( te[4], te[5], te[6] );
        panOffset.multiplyScalar(distance);

        pan.add( panOffset );
    };

    // main entry point; pass in Vector2 of change desired in pixel space,
    // right and down are positive
    this.pan = function ( delta ) {

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        if ( scope.object.fov !== undefined ) {

            // perspective
            var position = scope.object.position;
            var offset = position.clone().sub( scope.target );
            var targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan( (scope.object.fov/2) * Math.PI / 180.0 );
            // we actually don't use screenWidth, since perspective camera is fixed to screen height
            scope.panLeft( 2 * delta.x * targetDistance / element.clientHeight );
            scope.panUp( 2 * delta.y * targetDistance / element.clientHeight );

        } else if ( scope.object.top !== undefined ) {

            // orthographic
            scope.panLeft( delta.x * (scope.object.right - scope.object.left) / element.clientWidth );
            scope.panUp( delta.y * (scope.object.top - scope.object.bottom) / element.clientHeight );

        } else {

            // camera neither orthographic or perspective - warn user
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );

        }

    };

    this.dollyIn = function ( dollyScale ) {

        if ( dollyScale === undefined ) {

            dollyScale = getZoomScale();

        }

        scale /= dollyScale;

    };

    this.dollyOut = function ( dollyScale ) {

        if ( dollyScale === undefined ) {

            dollyScale = getZoomScale();

        }

        scale *= dollyScale;

    };

    this.update = function () {

        var position = this.object.position;
        var offset = position.clone().sub( this.target );

        // angle from z-axis around y-axis

        var theta = Math.atan2( offset.x, offset.z );

        // angle from y-axis

        var phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );

        if ( this.autoRotate ) {

            this.rotateLeft( getAutoRotationAngle() );

        }

        theta += thetaDelta;
        phi += phiDelta;

        // restrict phi to be between desired limits
        phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );

        // restrict phi to be betwee EPS and PI-EPS
        phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );

        var radius = offset.length() * scale;

        // restrict radius to be between desired limits
        radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );

        // move target to panned location
        this.target.add( pan );

        offset.x = radius * Math.sin( phi ) * Math.sin( theta );
        offset.y = radius * Math.cos( phi );
        offset.z = radius * Math.sin( phi ) * Math.cos( theta );

        position.copy( this.target ).add( offset );

        this.object.lookAt( this.target );

        thetaDelta = 0;
        phiDelta = 0;
        scale = 1;
        pan.set(0,0,0);

        if ( lastPosition.distanceTo( this.object.position ) > 0 ) {

            this.dispatchEvent( changeEvent );

            lastPosition.copy( this.object.position );

        }

    };


    function getAutoRotationAngle() {

        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

    }

    function getZoomScale() {

        return Math.pow( 0.95, scope.zoomSpeed );

    }

    function onMouseDown( event ) {

        if ( scope.enabled === false ) { return; }
        event.preventDefault();

        if ( event.button === 0 ) {
            if ( scope.noRotate === true ) { return; }

            state = STATE.ROTATE;

            rotateStart.set( event.clientX, event.clientY );

        } else if ( event.button === 1 ) {
            if ( scope.noZoom === true ) { return; }

            state = STATE.DOLLY;

            dollyStart.set( event.clientX, event.clientY );

        } else if ( event.button === 2 ) {
            if ( scope.noPan === true ) { return; }

            state = STATE.PAN;

            panStart.set( event.clientX, event.clientY );

        }

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        scope.domElement.addEventListener( 'mousemove', onMouseMove, false );
        scope.domElement.addEventListener( 'mouseup', onMouseUp, false );

    }

    function onMouseMove( event ) {

        if ( scope.enabled === false ) return;

        event.preventDefault();

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        if ( state === STATE.ROTATE ) {

            if ( scope.noRotate === true ) return;

            rotateEnd.set( event.clientX, event.clientY );
            rotateDelta.subVectors( rotateEnd, rotateStart );

            // rotating across whole screen goes 360 degrees around
            scope.rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );
            // rotating up and down along whole screen attempts to go 360, but limited to 180
            scope.rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

            rotateStart.copy( rotateEnd );

        } else if ( state === STATE.DOLLY ) {

            if ( scope.noZoom === true ) return;

            dollyEnd.set( event.clientX, event.clientY );
            dollyDelta.subVectors( dollyEnd, dollyStart );

            if ( dollyDelta.y > 0 ) {

                scope.dollyIn();

            } else {

                scope.dollyOut();

            }

            dollyStart.copy( dollyEnd );

        } else if ( state === STATE.PAN ) {

            if ( scope.noPan === true ) return;

            panEnd.set( event.clientX, event.clientY );
            panDelta.subVectors( panEnd, panStart );

            scope.pan( panDelta );

            panStart.copy( panEnd );

        }

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        scope.update();

    }

    function onMouseUp( /* event */ ) {

        if ( scope.enabled === false ) return;

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        scope.domElement.removeEventListener( 'mousemove', onMouseMove, false );
        scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );

        state = STATE.NONE;

    }

    function onMouseWheel( event ) {

        if ( scope.enabled === false || scope.noZoom === true ) return;

        var delta = 0;

        if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

            delta = event.wheelDelta;

        } else if ( event.detail ) { // Firefox

            delta = - event.detail;

        }

        if ( delta > 0 ) {

            scope.dollyOut();

        } else {

            scope.dollyIn();

        }

    }

    function onKeyDown( event ) {

        if ( scope.enabled === false ) { return; }
        if ( scope.noKeys === true ) { return; }
        if ( scope.noPan === true ) { return; }

        // pan a pixel - I guess for precise positioning?
        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        var needUpdate = false;

        switch ( event.keyCode ) {

            case scope.keys.UP:
                scope.pan( new THREE.Vector2( 0, scope.keyPanSpeed ) );
                needUpdate = true;
                break;
            case scope.keys.BOTTOM:
                scope.pan( new THREE.Vector2( 0, -scope.keyPanSpeed ) );
                needUpdate = true;
                break;
            case scope.keys.LEFT:
                scope.pan( new THREE.Vector2( scope.keyPanSpeed, 0 ) );
                needUpdate = true;
                break;
            case scope.keys.RIGHT:
                scope.pan( new THREE.Vector2( -scope.keyPanSpeed, 0 ) );
                needUpdate = true;
                break;
        }

        // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
        if ( needUpdate ) {

            scope.update();

        }

    }

    function touchstart( event ) {

        if ( scope.enabled === false ) { return; }

        switch ( event.touches.length ) {

            case 1:	// one-fingered touch: rotate
                if ( scope.noRotate === true ) { return; }

                state = STATE.TOUCH_ROTATE;

                rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                break;

            case 2:	// two-fingered touch: dolly
                if ( scope.noZoom === true ) { return; }

                state = STATE.TOUCH_DOLLY;

                var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
                var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
                var distance = Math.sqrt( dx * dx + dy * dy );
                dollyStart.set( 0, distance );
                break;

            case 3: // three-fingered touch: pan
                if ( scope.noPan === true ) { return; }

                state = STATE.TOUCH_PAN;

                panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                break;

            default:
                state = STATE.NONE;

        }
    }

    function touchmove( event ) {

        if ( scope.enabled === false ) { return; }

        event.preventDefault();
        event.stopPropagation();

        var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

        switch ( event.touches.length ) {

            case 1: // one-fingered touch: rotate
                if ( scope.noRotate === true ) { return; }
                if ( state !== STATE.TOUCH_ROTATE ) { return; }

                rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                rotateDelta.subVectors( rotateEnd, rotateStart );

                // rotating across whole screen goes 360 degrees around
                scope.rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );
                // rotating up and down along whole screen attempts to go 360, but limited to 180
                scope.rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

                rotateStart.copy( rotateEnd );
                break;

            case 2: // two-fingered touch: dolly
                if ( scope.noZoom === true ) { return; }
                if ( state !== STATE.TOUCH_DOLLY ) { return; }

                var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
                var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
                var distance = Math.sqrt( dx * dx + dy * dy );

                dollyEnd.set( 0, distance );
                dollyDelta.subVectors( dollyEnd, dollyStart );

                if ( dollyDelta.y > 0 ) {

                    scope.dollyOut();

                } else {

                    scope.dollyIn();

                }

                dollyStart.copy( dollyEnd );
                break;

            case 3: // three-fingered touch: pan
                if ( scope.noPan === true ) { return; }
                if ( state !== STATE.TOUCH_PAN ) { return; }

                panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
                panDelta.subVectors( panEnd, panStart );

                scope.pan( panDelta );

                panStart.copy( panEnd );
                break;

            default:
                state = STATE.NONE;

        }

    }

    function touchend( /* event */ ) {

        if ( scope.enabled === false ) { return; }

        state = STATE.NONE;
    }

    this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
    this.domElement.addEventListener( 'mousedown', onMouseDown, false );
    this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

    this.domElement.addEventListener( 'keydown', onKeyDown, false );

    this.domElement.addEventListener( 'touchstart', touchstart, false );
    this.domElement.addEventListener( 'touchend', touchend, false );
    this.domElement.addEventListener( 'touchmove', touchmove, false );

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};var Cell = function(x, y) {
  this.x = x;
  this.y = y;
  this.visited = false;

  // When solving the maze, this represents
  // the previous node in the navigated path.
  this.parent = null;

  this.heuristic = 0;

  this.visit = function () {
    this.visited = true;
  };

  this.score = function () {
  	var total = 0;
  	var p = this.parent;
  	
  	while(p) {
  		++total;
  		p = p.parent;
  	}
  	return total;
  };

  this.pathToOrigin = function () {
  	var path = [this];
  	var p = this.parent;
  	
  	while(p) {
  		path.push(p);
  		p = p.parent;
  	}
  	path.reverse();
  	
  	return path;
  };
};var Graph = function(width, height) {
  this.width = width;
  this.height = height;
  this.cells = [];
  this.removedEdges = [];

  var self = this;

  this.getCellAt = function (x, y) {
    if(x >= this.width || y >= this.height || x < 0 || y < 0) {
    	return null;
    }
    if(!this.cells[x]) {
    	return null;
    }
    return this.cells[x][y];
  };

  this.getCellDistance = function (cell1, cell2) {
    var xDist = Math.abs(cell1.x - cell2.x);
    var yDist = Math.abs(cell1.y - cell2.y);
    return Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
  },

  // Returns true if there is an edge between cell1 and cell2
  this.areConnected = function(cell1, cell2) {
  	if(!cell1 || !cell2) {
  		return false;
  	}
  	if(Math.abs(cell1.x - cell2.x) > 1 || 
  		Math.abs(cell1.y - cell2.y) > 1) {
  		return false;
  	}

  	var removedEdge = _.detect(this.removedEdges, function(edge) {
  		return _.include(edge, cell1) && _.include(edge, cell2);
  	});

  	return removedEdge == undefined;
  };

  this.cellUnvisitedNeighbors = function(cell) {
  	return _.select(this.cellConnectedNeighbors(cell), function(c) {
      return !c.visited;
    });
  };

  // Returns all neighbors of this cell that ARE separated by an edge (maze line)
  this.cellConnectedNeighbors = function(cell) {
    return _.select(this.cellNeighbors(cell), function(c) {
      return self.areConnected(cell, c);
    });
  };

  // Returns all neighbors of this cell that are NOT separated by an edge
  // This means there is a maze path between both cells.
  this.cellDisconnectedNeighbors = function (cell) {
    return _.reject(this.cellNeighbors(cell), function(c) {
      return self.areConnected(cell, c);
    });
  }

  // Returns all neighbors of this cell, regardless if they are connected or not.
  this.cellNeighbors = function (cell) {
    var neighbors = [];
    var topCell = this.getCellAt(cell.x, cell.y - 1);
    var rightCell = this.getCellAt(cell.x + 1, cell.y);
    var bottomCell = this.getCellAt(cell.x, cell.y + 1);
    var leftCell = this.getCellAt(cell.x - 1, cell.y);

    if(cell.y > 0 && topCell) {
      neighbors.push(topCell);
    }
    if(cell.x < this.width && rightCell) {
      neighbors.push(rightCell);
    }
    if(cell.y < this.height && bottomCell) {
      neighbors.push(bottomCell);
    }
    if(cell.x > 0 && leftCell) {
      neighbors.push(leftCell);
    }

    return neighbors;
  }

  this.removeEdgeBetween = function(cell1, cell2) {
  	this.removedEdges.push([cell1, cell2]);
  };

  for(var i = 0; i < this.width; i++) {
  	this.cells.push([]);
  	row = this.cells[i];

  	for(var j = 0; j < this.height; j++) {
  		var cell = new Cell(i, j, this);
  		row.push(cell);
  	}
  }
};var Maze = function(doc, elemId) {
    this.canvas = doc.getElementById(elemId);
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.ctx = this.canvas.getContext('2d');
    this.horizCells = 30;
    this.vertCells = 30;
    this.generator = new MazeGenerator(this.horizCells, this.vertCells);
    this.cellWidth = this.width / this.horizCells;
    this.cellHeight = this.height / this.vertCells;

    var self = this;

    self.ctx.strokeStyle = "rgb(0, 0, 0)";
    self.ctx.fillStyle = "rgba(255, 0, 0, 0.1)";

    return {
        width: function() {
            return self.width;
        },

        height: function() {
            return self.height;
        },

        generate: function () {
            self.generator.generate();
        },

        draw: function() {
            this.drawBorders();
            this.drawMaze();
        },

        solve: function() {
            self.generator.solve();
            this.drawSolution();
        },

        drawBorders: function() {
            this.drawLine(self.cellWidth, 0, self.width, 0);
            this.drawLine(self.width, 0, self.width, self.height);
            this.drawLine(self.width - self.cellWidth, self.height, 0, self.height);
            this.drawLine(0, self.height, 0, 0);
        },

        drawSolution: function() {
            var path = self.generator.path;

            for(var i = 0; i < path.length; i++) {
                (function () {
                    var cell = path[i];
                    var x = cell.x * self.cellWidth;
                    var y = cell.y * self.cellHeight;
                    setTimeout(function() {
                        self.ctx.fillRect(x, y, self.cellWidth, self.cellHeight);
                    }, 80 * i);
                })();
            }
        },

        drawMaze: function() {
            var graph = self.generator.graph;
            var drawnEdges = [];

            var edgeAlreadyDrawn = function(cell1, cell2) {
                return _.detect(drawnEdges, function(edge) {
                    return _.include(edge, cell1) && _.include(edge, cell2);
                }) != undefined;
            };

            for(var i = 0; i < graph.width; i++) {
                for(var j = 0; j < graph.height; j++) {
                    var cell = graph.cells[i][j];
                    var topCell = graph.getCellAt(cell.x, cell.y - 1);
                    var leftCell = graph.getCellAt(cell.x - 1, cell.y);
                    var rightCell = graph.getCellAt(cell.x + 1, cell.y);
                    var bottomCell = graph.getCellAt(cell.x, cell.y + 1);

                    if(!edgeAlreadyDrawn(cell, topCell) && graph.areConnected(cell, topCell)) {
                        var x1 = cell.x * self.cellWidth;
                        var y1 = cell.y * self.cellHeight;
                        var x2 = x1 + self.cellWidth;
                        var y2 = y1;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, topCell]);
                    }

                    if(!edgeAlreadyDrawn(cell, leftCell) && graph.areConnected(cell, leftCell)) {
                        var x2 = x1;
                        var y2 = y1 + self.cellHeight;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, leftCell]);
                    }

                    if(!edgeAlreadyDrawn(cell, rightCell) && graph.areConnected(cell, rightCell)) {
                        var x1 = (cell.x * self.cellWidth) + self.cellWidth;
                        var y1 = cell.y * self.cellHeight;
                        var x2 = x1;
                        var y2 = y1 + self.cellHeight;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, rightCell]);
                    }

                    if(!edgeAlreadyDrawn(cell, bottomCell) && graph.areConnected(cell, bottomCell)) {
                        var x1 = cell.x * self.cellWidth;
                        var y1 = (cell.y * self.cellHeight) + self.cellHeight;
                        var x2 = x1 + self.cellWidth;
                        var y2 = y1;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, bottomCell]);
                    }
                }
            }
        },

        drawLine: function(x1, y1, x2, y2) {
            self.ctx.beginPath();
            self.ctx.moveTo(x1, y1);
            self.ctx.lineTo(x2, y2);
            self.ctx.stroke();
        }
    };
};var Maze = function(scene, cells, width, height) {

    this.scene = scene;
    this.elements = [];

    this.width = width;
    this.height = height;

    this.horizCells = cells;
    this.vertCells = cells;
    this.generator = new MazeGenerator(this.horizCells, this.vertCells);
    this.cellWidth = this.width / this.horizCells;
    this.cellHeight = this.height / this.vertCells;

    var self = this;

    return {
        width: function() {
            return self.width;
        },

        height: function() {
            return self.height;
        },

        generate: function() {
            self.generator.generate();
        },

        draw: function() {
            this.drawBorders();
            this.drawMaze();
        },

        solve: function() {
            self.generator.solve();
            this.drawSolution();
        },

        drawBorders: function() {
            this.drawLine(self.cellWidth, 0, self.width, 0);
            this.drawLine(self.width, 0, self.width, self.height);
            this.drawLine(self.width - self.cellWidth, self.height, 0, self.height);
            this.drawLine(0, self.height, 0, 0);
        },

        drawSolution: function() {
            var path = self.generator.path;

            for (var i = 0; i < path.length; i++) {
                (function() {
                    var cell = path[i];
                    var x = cell.x * self.cellWidth;
                    var y = cell.y * self.cellHeight;
                    setTimeout(function() {
                        self.ctx.fillRect(x, y, self.cellWidth, self.cellHeight);
                    }, 80 * i);
                })();
            }
        },

        drawMaze: function() {
            var graph = self.generator.graph;
            var drawnEdges = [];

            var edgeAlreadyDrawn = function(cell1, cell2) {
                return _.detect(drawnEdges, function(edge) {
                    return _.include(edge, cell1) && _.include(edge, cell2);
                }) != undefined;
            };

            for (var i = 0; i < graph.width; i++) {
                for (var j = 0; j < graph.height; j++) {
                    var cell = graph.cells[i][j];
                    var topCell = graph.getCellAt(cell.x, cell.y - 1);
                    var leftCell = graph.getCellAt(cell.x - 1, cell.y);
                    var rightCell = graph.getCellAt(cell.x + 1, cell.y);
                    var bottomCell = graph.getCellAt(cell.x, cell.y + 1);

                    if (!edgeAlreadyDrawn(cell, topCell) && graph.areConnected(cell, topCell)) {
                        var x1 = cell.x * self.cellWidth;
                        var y1 = cell.y * self.cellHeight;
                        var x2 = x1 + self.cellWidth;
                        var y2 = y1;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, topCell]);
                    }

                    if (!edgeAlreadyDrawn(cell, leftCell) && graph.areConnected(cell, leftCell)) {
                        var x2 = x1;
                        var y2 = y1 + self.cellHeight;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, leftCell]);
                    }

                    if (!edgeAlreadyDrawn(cell, rightCell) && graph.areConnected(cell, rightCell)) {
                        var x1 = (cell.x * self.cellWidth) + self.cellWidth;
                        var y1 = cell.y * self.cellHeight;
                        var x2 = x1;
                        var y2 = y1 + self.cellHeight;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, rightCell]);
                    }

                    if (!edgeAlreadyDrawn(cell, bottomCell) && graph.areConnected(cell, bottomCell)) {
                        var x1 = cell.x * self.cellWidth;
                        var y1 = (cell.y * self.cellHeight) + self.cellHeight;
                        var x2 = x1 + self.cellWidth;
                        var y2 = y1;

                        this.drawLine(x1, y1, x2, y2);
                        drawnEdges.push([cell, bottomCell]);
                    }
                }
            }
        },

        getElements: function() {
            return self.elements;
        },

        drawLine: function(x1, y1, x2, y2) {
            var lengthX = Math.abs(x1 - x2);
            var lengthY = Math.abs(y1 - y2);

            // since only 90 degrees angles, so one of these is always 0
            // to add a certain thickness to the wall, set to 0.5
            if (lengthX === 0) lengthX = 1;
            if (lengthY === 0) lengthY = 1;

            // create a cube to represent the wall segment
            var wallGeom = new THREE.BoxGeometry(lengthX, 8, lengthY);
            var wallMaterial = new THREE.MeshBasicMaterial({ opacity: 1, transparent: false });

            var randomnumber = Math.floor(Math.random() * 10) + 1;
            var wallPaintTexturePath = "../assets/textures/wall/" + randomnumber + '.jpeg';
            wallMaterial.map = THREE.ImageUtils.loadTexture(wallPaintTexturePath);
            // wallMaterial.map.wrapS = wallMaterial.map.wrapT = THREE.RepeatWrapping;
            // wallMaterial.map.repeat.set(4, 4);
            // and create the complete wall segment
            var wallMesh = new THREE.Mesh(wallGeom, wallMaterial);

            // finally position it correctly
            wallMesh.position = new THREE.Vector3(x1 - ((x1 - x2) / 2) - (self.height / 2), wallGeom.height / 2, y1 - ((y1 - y2)) / 2 - (self.width / 2));

            self.elements.push(wallMesh);
            scene.add(wallMesh);
        }
    };
};
var MazeGenerator = function(rows, cols) {
	this.graph = new Graph(rows, cols);
	this.cellStack = [];

	var self = this;

	var recurse = function(cell) {
		cell.visit();
    var neighbors = self.graph.cellUnvisitedNeighbors(cell);
    if(neighbors.length > 0) {
    	var randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    	self.cellStack.push(cell);
    	self.graph.removeEdgeBetween(cell, randomNeighbor);
    	recurse(randomNeighbor);
    }
    else {
    	var waitingCell = self.cellStack.pop();
    	if(waitingCell) {
    		recurse(waitingCell);
    	}
    }
  };

  this.solve = function() {
    var closedSet = [];
    var startCell = this.graph.getCellAt(0, 0); // top left cell
    var targetCell = this.graph.getCellAt(this.graph.width - 1, this.graph.height - 1); // bottom right cell
    var openSet = [startCell];
    var searchCell = startCell;

    while(openSet.length > 0) {
      var neighbors = this.graph.cellDisconnectedNeighbors(searchCell);
      for(var i = 0; i < neighbors.length; i ++) {
        var neighbor = neighbors[i];
        if(neighbor == targetCell) {
          neighbor.parent = searchCell;
          this.path = neighbor.pathToOrigin();
          openSet = [];
          return;
        }
        if(!_.include(closedSet, neighbor)) {
          if(!_.include(openSet, neighbor)) {
            openSet.push(neighbor);
            neighbor.parent = searchCell;
            neighbor.heuristic = neighbor.score() + this.graph.getCellDistance(neighbor, targetCell);
          }
        }
      }
      closedSet.push(searchCell);
      openSet.remove(_.indexOf(openSet, searchCell));
      searchCell = null;

      _.each(openSet, function(cell) {
        if(!searchCell) {
          searchCell = cell;
        }
        else if(searchCell.heuristic > cell.heuristic) {
          searchCell = cell;
        }
      });
    }
  };

	this.generate = function() {
		var initialCell = this.graph.getCellAt(0, 0);
		recurse(initialCell);
	};
};// Underscore.js 1.3.3
// (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the MIT license.
// Portions of Underscore are inspired or borrowed from Prototype,
// Oliver Steele's Functional, and John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore
(function(){function r(a,c,d){if(a===c)return 0!==a||1/a==1/c;if(null==a||null==c)return a===c;a._chain&&(a=a._wrapped);c._chain&&(c=c._wrapped);if(a.isEqual&&b.isFunction(a.isEqual))return a.isEqual(c);if(c.isEqual&&b.isFunction(c.isEqual))return c.isEqual(a);var e=l.call(a);if(e!=l.call(c))return!1;switch(e){case "[object String]":return a==""+c;case "[object Number]":return a!=+a?c!=+c:0==a?1/a==1/c:a==+c;case "[object Date]":case "[object Boolean]":return+a==+c;case "[object RegExp]":return a.source==
c.source&&a.global==c.global&&a.multiline==c.multiline&&a.ignoreCase==c.ignoreCase}if("object"!=typeof a||"object"!=typeof c)return!1;for(var f=d.length;f--;)if(d[f]==a)return!0;d.push(a);var f=0,g=!0;if("[object Array]"==e){if(f=a.length,g=f==c.length)for(;f--&&(g=f in a==f in c&&r(a[f],c[f],d)););}else{if("constructor"in a!="constructor"in c||a.constructor!=c.constructor)return!1;for(var h in a)if(b.has(a,h)&&(f++,!(g=b.has(c,h)&&r(a[h],c[h],d))))break;if(g){for(h in c)if(b.has(c,h)&&!f--)break;
g=!f}}d.pop();return g}var s=this,I=s._,o={},k=Array.prototype,p=Object.prototype,i=k.slice,J=k.unshift,l=p.toString,K=p.hasOwnProperty,y=k.forEach,z=k.map,A=k.reduce,B=k.reduceRight,C=k.filter,D=k.every,E=k.some,q=k.indexOf,F=k.lastIndexOf,p=Array.isArray,L=Object.keys,t=Function.prototype.bind,b=function(a){return new m(a)};"undefined"!==typeof exports?("undefined"!==typeof module&&module.exports&&(exports=module.exports=b),exports._=b):s._=b;b.VERSION="1.3.3";var j=b.each=b.forEach=function(a,
c,d){if(a!=null)if(y&&a.forEach===y)a.forEach(c,d);else if(a.length===+a.length)for(var e=0,f=a.length;e<f;e++){if(e in a&&c.call(d,a[e],e,a)===o)break}else for(e in a)if(b.has(a,e)&&c.call(d,a[e],e,a)===o)break};b.map=b.collect=function(a,c,b){var e=[];if(a==null)return e;if(z&&a.map===z)return a.map(c,b);j(a,function(a,g,h){e[e.length]=c.call(b,a,g,h)});if(a.length===+a.length)e.length=a.length;return e};b.reduce=b.foldl=b.inject=function(a,c,d,e){var f=arguments.length>2;a==null&&(a=[]);if(A&&
a.reduce===A){e&&(c=b.bind(c,e));return f?a.reduce(c,d):a.reduce(c)}j(a,function(a,b,i){if(f)d=c.call(e,d,a,b,i);else{d=a;f=true}});if(!f)throw new TypeError("Reduce of empty array with no initial value");return d};b.reduceRight=b.foldr=function(a,c,d,e){var f=arguments.length>2;a==null&&(a=[]);if(B&&a.reduceRight===B){e&&(c=b.bind(c,e));return f?a.reduceRight(c,d):a.reduceRight(c)}var g=b.toArray(a).reverse();e&&!f&&(c=b.bind(c,e));return f?b.reduce(g,c,d,e):b.reduce(g,c)};b.find=b.detect=function(a,
c,b){var e;G(a,function(a,g,h){if(c.call(b,a,g,h)){e=a;return true}});return e};b.filter=b.select=function(a,c,b){var e=[];if(a==null)return e;if(C&&a.filter===C)return a.filter(c,b);j(a,function(a,g,h){c.call(b,a,g,h)&&(e[e.length]=a)});return e};b.reject=function(a,c,b){var e=[];if(a==null)return e;j(a,function(a,g,h){c.call(b,a,g,h)||(e[e.length]=a)});return e};b.every=b.all=function(a,c,b){var e=true;if(a==null)return e;if(D&&a.every===D)return a.every(c,b);j(a,function(a,g,h){if(!(e=e&&c.call(b,
a,g,h)))return o});return!!e};var G=b.some=b.any=function(a,c,d){c||(c=b.identity);var e=false;if(a==null)return e;if(E&&a.some===E)return a.some(c,d);j(a,function(a,b,h){if(e||(e=c.call(d,a,b,h)))return o});return!!e};b.include=b.contains=function(a,c){var b=false;if(a==null)return b;if(q&&a.indexOf===q)return a.indexOf(c)!=-1;return b=G(a,function(a){return a===c})};b.invoke=function(a,c){var d=i.call(arguments,2);return b.map(a,function(a){return(b.isFunction(c)?c||a:a[c]).apply(a,d)})};b.pluck=
function(a,c){return b.map(a,function(a){return a[c]})};b.max=function(a,c,d){if(!c&&b.isArray(a)&&a[0]===+a[0])return Math.max.apply(Math,a);if(!c&&b.isEmpty(a))return-Infinity;var e={computed:-Infinity};j(a,function(a,b,h){b=c?c.call(d,a,b,h):a;b>=e.computed&&(e={value:a,computed:b})});return e.value};b.min=function(a,c,d){if(!c&&b.isArray(a)&&a[0]===+a[0])return Math.min.apply(Math,a);if(!c&&b.isEmpty(a))return Infinity;var e={computed:Infinity};j(a,function(a,b,h){b=c?c.call(d,a,b,h):a;b<e.computed&&
(e={value:a,computed:b})});return e.value};b.shuffle=function(a){var b=[],d;j(a,function(a,f){d=Math.floor(Math.random()*(f+1));b[f]=b[d];b[d]=a});return b};b.sortBy=function(a,c,d){var e=b.isFunction(c)?c:function(a){return a[c]};return b.pluck(b.map(a,function(a,b,c){return{value:a,criteria:e.call(d,a,b,c)}}).sort(function(a,b){var c=a.criteria,d=b.criteria;return c===void 0?1:d===void 0?-1:c<d?-1:c>d?1:0}),"value")};b.groupBy=function(a,c){var d={},e=b.isFunction(c)?c:function(a){return a[c]};
j(a,function(a,b){var c=e(a,b);(d[c]||(d[c]=[])).push(a)});return d};b.sortedIndex=function(a,c,d){d||(d=b.identity);for(var e=0,f=a.length;e<f;){var g=e+f>>1;d(a[g])<d(c)?e=g+1:f=g}return e};b.toArray=function(a){return!a?[]:b.isArray(a)||b.isArguments(a)?i.call(a):a.toArray&&b.isFunction(a.toArray)?a.toArray():b.values(a)};b.size=function(a){return b.isArray(a)?a.length:b.keys(a).length};b.first=b.head=b.take=function(a,b,d){return b!=null&&!d?i.call(a,0,b):a[0]};b.initial=function(a,b,d){return i.call(a,
0,a.length-(b==null||d?1:b))};b.last=function(a,b,d){return b!=null&&!d?i.call(a,Math.max(a.length-b,0)):a[a.length-1]};b.rest=b.tail=function(a,b,d){return i.call(a,b==null||d?1:b)};b.compact=function(a){return b.filter(a,function(a){return!!a})};b.flatten=function(a,c){return b.reduce(a,function(a,e){if(b.isArray(e))return a.concat(c?e:b.flatten(e));a[a.length]=e;return a},[])};b.without=function(a){return b.difference(a,i.call(arguments,1))};b.uniq=b.unique=function(a,c,d){var d=d?b.map(a,d):a,
e=[];a.length<3&&(c=true);b.reduce(d,function(d,g,h){if(c?b.last(d)!==g||!d.length:!b.include(d,g)){d.push(g);e.push(a[h])}return d},[]);return e};b.union=function(){return b.uniq(b.flatten(arguments,true))};b.intersection=b.intersect=function(a){var c=i.call(arguments,1);return b.filter(b.uniq(a),function(a){return b.every(c,function(c){return b.indexOf(c,a)>=0})})};b.difference=function(a){var c=b.flatten(i.call(arguments,1),true);return b.filter(a,function(a){return!b.include(c,a)})};b.zip=function(){for(var a=
i.call(arguments),c=b.max(b.pluck(a,"length")),d=Array(c),e=0;e<c;e++)d[e]=b.pluck(a,""+e);return d};b.indexOf=function(a,c,d){if(a==null)return-1;var e;if(d){d=b.sortedIndex(a,c);return a[d]===c?d:-1}if(q&&a.indexOf===q)return a.indexOf(c);d=0;for(e=a.length;d<e;d++)if(d in a&&a[d]===c)return d;return-1};b.lastIndexOf=function(a,b){if(a==null)return-1;if(F&&a.lastIndexOf===F)return a.lastIndexOf(b);for(var d=a.length;d--;)if(d in a&&a[d]===b)return d;return-1};b.range=function(a,b,d){if(arguments.length<=
1){b=a||0;a=0}for(var d=arguments[2]||1,e=Math.max(Math.ceil((b-a)/d),0),f=0,g=Array(e);f<e;){g[f++]=a;a=a+d}return g};var H=function(){};b.bind=function(a,c){var d,e;if(a.bind===t&&t)return t.apply(a,i.call(arguments,1));if(!b.isFunction(a))throw new TypeError;e=i.call(arguments,2);return d=function(){if(!(this instanceof d))return a.apply(c,e.concat(i.call(arguments)));H.prototype=a.prototype;var b=new H,g=a.apply(b,e.concat(i.call(arguments)));return Object(g)===g?g:b}};b.bindAll=function(a){var c=
i.call(arguments,1);c.length==0&&(c=b.functions(a));j(c,function(c){a[c]=b.bind(a[c],a)});return a};b.memoize=function(a,c){var d={};c||(c=b.identity);return function(){var e=c.apply(this,arguments);return b.has(d,e)?d[e]:d[e]=a.apply(this,arguments)}};b.delay=function(a,b){var d=i.call(arguments,2);return setTimeout(function(){return a.apply(null,d)},b)};b.defer=function(a){return b.delay.apply(b,[a,1].concat(i.call(arguments,1)))};b.throttle=function(a,c){var d,e,f,g,h,i,j=b.debounce(function(){h=
g=false},c);return function(){d=this;e=arguments;f||(f=setTimeout(function(){f=null;h&&a.apply(d,e);j()},c));g?h=true:i=a.apply(d,e);j();g=true;return i}};b.debounce=function(a,b,d){var e;return function(){var f=this,g=arguments;d&&!e&&a.apply(f,g);clearTimeout(e);e=setTimeout(function(){e=null;d||a.apply(f,g)},b)}};b.once=function(a){var b=false,d;return function(){if(b)return d;b=true;return d=a.apply(this,arguments)}};b.wrap=function(a,b){return function(){var d=[a].concat(i.call(arguments,0));
return b.apply(this,d)}};b.compose=function(){var a=arguments;return function(){for(var b=arguments,d=a.length-1;d>=0;d--)b=[a[d].apply(this,b)];return b[0]}};b.after=function(a,b){return a<=0?b():function(){if(--a<1)return b.apply(this,arguments)}};b.keys=L||function(a){if(a!==Object(a))throw new TypeError("Invalid object");var c=[],d;for(d in a)b.has(a,d)&&(c[c.length]=d);return c};b.values=function(a){return b.map(a,b.identity)};b.functions=b.methods=function(a){var c=[],d;for(d in a)b.isFunction(a[d])&&
c.push(d);return c.sort()};b.extend=function(a){j(i.call(arguments,1),function(b){for(var d in b)a[d]=b[d]});return a};b.pick=function(a){var c={};j(b.flatten(i.call(arguments,1)),function(b){b in a&&(c[b]=a[b])});return c};b.defaults=function(a){j(i.call(arguments,1),function(b){for(var d in b)a[d]==null&&(a[d]=b[d])});return a};b.clone=function(a){return!b.isObject(a)?a:b.isArray(a)?a.slice():b.extend({},a)};b.tap=function(a,b){b(a);return a};b.isEqual=function(a,b){return r(a,b,[])};b.isEmpty=
function(a){if(a==null)return true;if(b.isArray(a)||b.isString(a))return a.length===0;for(var c in a)if(b.has(a,c))return false;return true};b.isElement=function(a){return!!(a&&a.nodeType==1)};b.isArray=p||function(a){return l.call(a)=="[object Array]"};b.isObject=function(a){return a===Object(a)};b.isArguments=function(a){return l.call(a)=="[object Arguments]"};b.isArguments(arguments)||(b.isArguments=function(a){return!(!a||!b.has(a,"callee"))});b.isFunction=function(a){return l.call(a)=="[object Function]"};
b.isString=function(a){return l.call(a)=="[object String]"};b.isNumber=function(a){return l.call(a)=="[object Number]"};b.isFinite=function(a){return b.isNumber(a)&&isFinite(a)};b.isNaN=function(a){return a!==a};b.isBoolean=function(a){return a===true||a===false||l.call(a)=="[object Boolean]"};b.isDate=function(a){return l.call(a)=="[object Date]"};b.isRegExp=function(a){return l.call(a)=="[object RegExp]"};b.isNull=function(a){return a===null};b.isUndefined=function(a){return a===void 0};b.has=function(a,
b){return K.call(a,b)};b.noConflict=function(){s._=I;return this};b.identity=function(a){return a};b.times=function(a,b,d){for(var e=0;e<a;e++)b.call(d,e)};b.escape=function(a){return(""+a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;")};b.result=function(a,c){if(a==null)return null;var d=a[c];return b.isFunction(d)?d.call(a):d};b.mixin=function(a){j(b.functions(a),function(c){M(c,b[c]=a[c])})};var N=0;b.uniqueId=
function(a){var b=N++;return a?a+b:b};b.templateSettings={evaluate:/<%([\s\S]+?)%>/g,interpolate:/<%=([\s\S]+?)%>/g,escape:/<%-([\s\S]+?)%>/g};var u=/.^/,n={"\\":"\\","'":"'",r:"\r",n:"\n",t:"\t",u2028:"\u2028",u2029:"\u2029"},v;for(v in n)n[n[v]]=v;var O=/\\|'|\r|\n|\t|\u2028|\u2029/g,P=/\\(\\|'|r|n|t|u2028|u2029)/g,w=function(a){return a.replace(P,function(a,b){return n[b]})};b.template=function(a,c,d){d=b.defaults(d||{},b.templateSettings);a="__p+='"+a.replace(O,function(a){return"\\"+n[a]}).replace(d.escape||
u,function(a,b){return"'+\n_.escape("+w(b)+")+\n'"}).replace(d.interpolate||u,function(a,b){return"'+\n("+w(b)+")+\n'"}).replace(d.evaluate||u,function(a,b){return"';\n"+w(b)+"\n;__p+='"})+"';\n";d.variable||(a="with(obj||{}){\n"+a+"}\n");var a="var __p='';var print=function(){__p+=Array.prototype.join.call(arguments, '')};\n"+a+"return __p;\n",e=new Function(d.variable||"obj","_",a);if(c)return e(c,b);c=function(a){return e.call(this,a,b)};c.source="function("+(d.variable||"obj")+"){\n"+a+"}";return c};
b.chain=function(a){return b(a).chain()};var m=function(a){this._wrapped=a};b.prototype=m.prototype;var x=function(a,c){return c?b(a).chain():a},M=function(a,c){m.prototype[a]=function(){var a=i.call(arguments);J.call(a,this._wrapped);return x(c.apply(b,a),this._chain)}};b.mixin(b);j("pop,push,reverse,shift,sort,splice,unshift".split(","),function(a){var b=k[a];m.prototype[a]=function(){var d=this._wrapped;b.apply(d,arguments);var e=d.length;(a=="shift"||a=="splice")&&e===0&&delete d[0];return x(d,
this._chain)}});j(["concat","join","slice"],function(a){var b=k[a];m.prototype[a]=function(){return x(b.apply(this._wrapped,arguments),this._chain)}});m.prototype.chain=function(){this._chain=true;return this};m.prototype.value=function(){return this._wrapped}}).call(this);
// stats.js - http://github.com/mrdoob/stats.js
var Stats=function(){var l=Date.now(),m=l,g=0,n=Infinity,o=0,h=0,p=Infinity,q=0,r=0,s=0,f=document.createElement("div");f.id="stats";f.addEventListener("mousedown",function(b){b.preventDefault();t(++s%2)},!1);f.style.cssText="width:80px;opacity:0.9;cursor:pointer";var a=document.createElement("div");a.id="fps";a.style.cssText="padding:0 0 3px 3px;text-align:left;background-color:#002";f.appendChild(a);var i=document.createElement("div");i.id="fpsText";i.style.cssText="color:#0ff;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px";
    i.innerHTML="FPS";a.appendChild(i);var c=document.createElement("div");c.id="fpsGraph";c.style.cssText="position:relative;width:74px;height:30px;background-color:#0ff";for(a.appendChild(c);74>c.children.length;){var j=document.createElement("span");j.style.cssText="width:1px;height:30px;float:left;background-color:#113";c.appendChild(j)}var d=document.createElement("div");d.id="ms";d.style.cssText="padding:0 0 3px 3px;text-align:left;background-color:#020;display:none";f.appendChild(d);var k=document.createElement("div");
    k.id="msText";k.style.cssText="color:#0f0;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px";k.innerHTML="MS";d.appendChild(k);var e=document.createElement("div");e.id="msGraph";e.style.cssText="position:relative;width:74px;height:30px;background-color:#0f0";for(d.appendChild(e);74>e.children.length;)j=document.createElement("span"),j.style.cssText="width:1px;height:30px;float:left;background-color:#131",e.appendChild(j);var t=function(b){s=b;switch(s){case 0:a.style.display=
        "block";d.style.display="none";break;case 1:a.style.display="none",d.style.display="block"}};return{REVISION:11,domElement:f,setMode:t,begin:function(){l=Date.now()},end:function(){var b=Date.now();g=b-l;n=Math.min(n,g);o=Math.max(o,g);k.textContent=g+" MS ("+n+"-"+o+")";var a=Math.min(30,30-30*(g/200));e.appendChild(e.firstChild).style.height=a+"px";r++;b>m+1E3&&(h=Math.round(1E3*r/(b-m)),p=Math.min(p,h),q=Math.max(q,h),i.textContent=h+" FPS ("+p+"-"+q+")",a=Math.min(30,30-30*(h/100)),c.appendChild(c.firstChild).style.height=
        a+"px",m=b,r=0);return b},update:function(){l=this.end()}}};