// add my utils to three version 67
THREE.MyUtils = {
    cameraLookDir: function(camera) {
        var vector = new THREE.Vector3(0, 0, -1);
        vector.applyEuler(camera.rotation, camera.eulerOrder);
        return vector;
    }
};

var rootPath = "http://www.lohosoft.com/vrmaze/";
// global variables
var renderer;
var scene;
var camera;
var control;
var stats;
var cube;
var touch; // detect if user touch the screen
var cubeStartPoint = new THREE.Vector3(width / 2 - 3, 1, width / 2 - 3);
var collidableMeshList = [];


var width = 100;

var speed = 1.0; //  camera and cube moving speed factor


function createCube() {

    var cubeGeometry = new THREE.BoxGeometry(3, 8, 3);
    // TODO set invisible in production as camera collide 
    var cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: false, opacity: 1 });
    cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.castShadow = true;
    cube.name = 'cube';
    cube.position = cubeStartPoint.clone();
    scene.add(cube);

}

function createMaze() {
    // generate a maze
    var maze = new Maze(scene, 15, width, width);
    maze.generate();
    maze.draw();
    var walls = maze.getElements();
    walls.forEach(function(e) { collidableMeshList.push(e) });


};

function setRenderer() {
    // create a render, sets the background color and the size
    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor('#AEEEEE', 1.0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMapEnabled = false;

};

function setFloor() {
    var planeGeometry = new THREE.PlaneGeometry(width, width, 40, 40);
    var planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var texturePath = rootPath + "assets/textures/wood_1-240x240.png";
    console.log(texturePath);
    planeMaterial.map = THREE.ImageUtils.loadTexture(texturePath);
    planeMaterial.map.wrapS = planeMaterial.map.wrapT = THREE.RepeatWrapping;
    planeMaterial.map.repeat.set(1, 1);
    var plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.receiveShadow = true;

    // rotate and position the plane
    plane.rotation.x = -0.5 * Math.PI;
    //        plane.position.y = ;

    // add the plane to the scene
    scene.add(plane);
};

function setStartEndWall() {
    var startWall = new THREE.BoxGeometry(10, 2, 1);
    var startMesh = new THREE.Mesh(startWall);
    startMesh.position.set(width / 2 - 5, 0, width / 2);
    scene.add(startMesh);
    collidableMeshList.push(startMesh);

    var endWall = new THREE.BoxGeometry(10, 2, 1);
    var endMesh = new THREE.Mesh(endWall);
    endMesh.position.set(-width / 2 + 5, 0, -width / 2);
    scene.add(endMesh);
    collidableMeshList.push(endMesh);
};

function setCamera() {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

    // position and point the camera to the center of the scene
    camera.position = cube.position;
    camera.lookAt(new THREE.Vector3(10, 0, 35));
    // TODO observer camera
    // control = new THREE.OrbitControls(camera);
    control = new THREE.DeviceOrientationControls(camera);

};


function handleTouch() {
    // let cube to tesk if hit with walls
    // if not , move camera 
    // if hit , camera don't move , cube position will sync with camera again
    var cameraLookDir = THREE.MyUtils.cameraLookDir(camera);
    cube.position.x += cameraLookDir.x * speed;
    cube.position.z += cameraLookDir.z * speed;

    // detectCollision();
    if (detectCollision()) {
        alert("撞到墙了！重新开始！");
        cube.position = cubeStartPoint.clone();
    }
    camera.position = cube.position;

};
/**
 * Initializes the scene, camera and objects. Called when the window is
 * loaded by using window.onload (see below)
 */
function init() {



    // create a scene, that will hold all our elements such as objects, cameras and lights.
    scene = new THREE.Scene();
    createMaze();

    // add cube
    createCube();

    setRenderer();
    // create the ground plane
    setFloor();

    setStartEndWall();

    setCamera();

    // add extras

    addStatsObject();


    // add the output of the renderer to the html element
    document.body.appendChild(renderer.domElement);

    // call the render function, after the first render, interval is determined
    // by requestAnimationFrame

    document.body.addEventListener('touchstart', function(e) {
        handleTouch();
    }, false);


    render();
}


function addStatsObject() {
    stats = new Stats();
    stats.setMode(0);

    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';

    document.body.appendChild(stats.domElement);
}


/**
 * Called when the scene needs to be rendered. Delegates to requestAnimationFrame
 * for future renders
 */
function render() {

    // sync camera with cube position
    // cube.position = camera.position;
    // update stats
    stats.update();

    // and render the scene
    renderer.render(scene, camera);

    // handle touch
    // detectCollision();

    control.update();

    // render using requestAnimationFrame
    requestAnimationFrame(render);
}

function detectCollision() {
    // collision detection:
    //   determines if any of the rays from the cube's origin to each vertex
    //      intersects any face of a mesh in the array of target meshes
    //   for increased collision accuracy, add more vertices to the cube;
    //      for example, new THREE.BoxGeometry( 64, 64, 64, 8, 8, 8, wireMaterial )
    //   HOWEVER: when the origin of the ray is within the target mesh, collisions do not occur
    var cube = scene.getObjectByName('cube');
    var originPoint = cube.position.clone();


    for (var vertexIndex = 0; vertexIndex < cube.geometry.vertices.length; vertexIndex++) {
        var localVertex = cube.geometry.vertices[vertexIndex].clone();
        var globalVertex = localVertex.applyMatrix4(cube.matrix);
        var directionVector = globalVertex.sub(cube.position);

        var ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
        var collisionResults = ray.intersectObjects(collidableMeshList);

        if (collisionResults.length > 0 && collisionResults[0].distance < directionVector.length()) {

            // if we've got a hit, we just stop the current walk and reset to base point
            // collided = true;
            // console.log('collided is ' + collided);
            return true;
        } else {
            // collided = false;
            // console.log('collided is ' + collided);
            return false;

        }
    }
}



/**
 * Function handles the resize event. This make sure the camera and the renderer
 * are updated at the correct moment.
 */
function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// calls the init function when the window is done loading.
window.onload = init;
// calls the handleResize function when the window is resized
window.addEventListener('resize', handleResize, false);
