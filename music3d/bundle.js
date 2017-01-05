!function(o){function e(i){if(n[i])return n[i].exports;var t=n[i]={exports:{},id:i,loaded:!1};return o[i].call(t.exports,t,t.exports,e),t.loaded=!0,t.exports}var n={};return e.m=o,e.c=n,e.p="",e(0)}([function(o,e,n){o.exports=n(1)},function(o,e,n){"use strict";function i(){console.log("songLoaded"),p.audio.play(),console.log(p.audio)}function t(){console.log("songLoadFailed")}function s(){console.log("songLoading")}function r(){d.resize()}function a(){g+=1;var o=p.fft.analyze();if(!d.hmrUpdating())for(var e=f.myGlobal.cubes.length-1;e>=0;e--)if(f.myGlobal.cubes[e].scale.set(1,(o[e]/255+1)*f.mesh.cube.scaleFactor,1),g%600===0){var n=m.makeColorString("rgb");f.myGlobal.cubes[e].material.color.set(n)}d.update(),requestAnimationFrame(a)}function c(){console.log("mySetup"),console.log("my3d updating is "+d.hmrUpdating()),console.log(f.myGlobal.cubes.length),a()}function u(){f=l,f.myGlobal={},f.myGlobal.cubes=[],window.addEventListener("resize",r,!1),console.log("myInit"),p.fft=new p5.FFT,p.audio=new p5.SoundFile(f.audio.songfile,i,t,s),console.log(p.audio),p.fft.setInput(p.audio),d.init(f),c()}var d=n(2),l=n(3),p={},m=n(4),f=void 0,g=0;window.onload=u},function(o,e){"use strict";function n(o,e){var n=new THREE.BoxBufferGeometry(e,e,e),i=(u.myGlobal.cubes.length,new THREE.MeshLambertMaterial),t=new THREE.Mesh(n,i);console.log("make cube with :"+o),t.position.set(o.x,o.y,o.z),p.add(t),u.myGlobal.cubes.push(t)}function i(){for(var o=u.mesh.cube.size/2,e=(u.mesh.cube.mat,-16);e<16;e++)for(var i=-16;i<16;i++){var t={x:e*u.mesh.cube.size,y:o,z:i*u.mesh.cube.size};n(t,u.mesh.cube.size)}}function t(){return function(){return f}()}function s(o){console.log("my3d.js init"),f=!0,console.log("my3d.js init with hmrUpdating : "+f),u=o,d=new THREE.WebGLRenderer;var e=document.querySelector(u.scene.dom);e.innerHTML="",l=new THREE.PerspectiveCamera(u.camera.viewAngle,window.innerWidth/window.innerHeight,u.camera.near,u.camera.far),l.position.set(u.camera.position.x,u.camera.position.y,u.camera.position.z),p=new THREE.Scene,p.add(l),l.lookAt(p.position),g=new THREE.OrbitControls(l),c(),e.appendChild(d.domElement),r()}function r(){console.log("my3d.js setup"),i();var o=new THREE.PointLight(16777215),e=new THREE.PointLight(16777215),n=new THREE.PointLight(16777215),t=new THREE.PointLight(16777215);o.position.x=180,o.position.y=180,o.position.z=0,p.add(o),m.push(o),e.position.x=0,e.position.y=180,e.position.z=180,p.add(e),m.push(e),n.position.x=-180,n.position.y=180,n.position.z=0,p.add(n),m.push(n),t.position.x=0,t.position.y=180,t.position.z=-180,p.add(t),m.push(t),f=!1,console.log("my3d.js setup with hmrUpdating : "+f)}function a(o){d.render(p,l),g.update()}function c(){l.aspect=window.innerWidth/window.innerHeight,l.updateProjectionMatrix(),d.setSize(window.innerWidth,window.innerHeight)}var u=void 0,d=void 0,l=void 0,p=void 0,m=[],f=!0,g=void 0;o.exports.hmrUpdating=t,o.exports.init=s,o.exports.setup=r,o.exports.update=a,o.exports.resize=c},function(o,e){"use strict";o.exports={audio:{songfile:"http://www.lohosoft.com/music3d/assets/sumerashes.mp3"},vision:{},mesh:{cube:{size:5,scaleFactor:20}},scene:{dom:"#container"},camera:{viewAngle:90,near:.1,far:1e3,position:{x:0,y:100,z:120}}}},function(o,e){"use strict";function n(o){var e=void 0;if("hsl"===o){var n=i(0,360)/360,t=1,s=1;e=n+","+t+","+s}else if("rgb"===o){var r=i(0,255),a=i(0,255),c=i(0,255);e="rgb("+r+","+a+","+c+")"}return e}function i(o,e){var n=e-o,i=Math.random()*n+o;return parseInt(i,10)}o.exports.makeColorString=n,o.exports.makeRandomInt=i}]);