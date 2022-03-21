"use strict";

import './tailwind.css';
import * as THREE from 'three';
import gsap from 'gsap';

import operations from './operations.json';
import vertexShader from './shaders/vertex.glsl';
import fragmentShader from './shaders/fragment.glsl';
import atmosphereVertexShader from './shaders/atmosphereVertex.glsl';
import atmosphereFragmentShader from './shaders/atmosphereFragment.glsl';


const canvasContainer = document.querySelector('#canvasContainer');

const scene = new THREE.Scene();

let camera = new THREE.PerspectiveCamera(
  75,
  canvasContainer.offsetWidth / canvasContainer.offsetHeight,
  0.1,
  1000
)

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: document.querySelector('canvas')
});

renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
renderer.setPixelRatio(window.devicePixelRatio);

/**
 * Sphere - main globe body
*/

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(5, 50, 50),
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      globeTexture: {
        value: new THREE.TextureLoader().load('./maptexture.jpeg')
      }
    }
  })
)
// scene.add(sphere); sphere now in group object


/**
 * Atmosphere (outer glow effect) - sphere is slightly bigger than the other one to create glow effect
*/

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(5, 50, 50),
  new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    blending: THREE.AdditiveBlending, // blends shader
    side: THREE.BackSide // adds shadow
  })
)
atmosphere.scale.set(1.1, 1.1, 1.1);
scene.add(atmosphere);

// create group so that sphere will rotate whilst mouse moves
const group = new THREE.Group();
group.add(sphere);
scene.add(group);


/**
 * Stars - add WebGL later to fix square looking particles
*/

const starGeometry = new THREE.BufferGeometry();
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
})

const starVertices = [];
for (let i = 0; i < 10000; i++) {
  const x = (Math.random() - 0.5) * 2000;
  const y = (Math.random() - 0.5) * 2000;
  const z = -Math.random() * 3000; // use negative so that stars place behind globe
  starVertices.push(x, y, z);
}

// console.log(starVertices)
// position attribute for starGeometry, starVertices will convert to a Float32BufferAttribute
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);


/**
 * Camera
*/

// needs camera to add sphere to scene
camera.position.y = 5;
camera.position.z = 8;

// zoom camera position on load with GSAP 
gsap.to( camera.position, {
  duration: 2,
  x: 10,
  y: 5,
  z: 8,
  onUpdate: function() {
    camera.lookAt( sphere.position );
  }
} );


/**
 * Create points for multiple countries
*/

function createGlobePoints(operations) {

  // look through each country in json array
  operations.forEach((operation) => {

    const lat = operation.lat
    const lng = operation.lng

    const globePoint = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 2),
      new THREE.MeshBasicMaterial({
        color: '#3BF7FF',
        opacity: 0.4,
        transparent: true,
      })
    )

    const latitude = (lat / 180) * Math.PI;
    const longitude = (lng / 180) * Math.PI;
    const radius = 5; // radius of 1st sphereGeometry

    const x = radius * Math.cos(latitude) * Math.sin(longitude)
    const y = radius * Math.sin(latitude)
    const z = radius * Math.cos(latitude) * Math.cos(longitude)

    // console.log({x,y,z})
    globePoint.position.x = x;
    globePoint.position.y = y;
    globePoint.position.z = z;

    // specify which direction the point should be looking at
    globePoint.lookAt(0, 0, 0);
    globePoint.geometry.applyMatrix4(
      new THREE.Matrix4().makeTranslation(0, 0, 0)
    ); // 4 x 4 matrix - three.js method to move things within 3d space
    // this prevents boxes from being away from globe surface 

    group.add(globePoint);

    gsap.to(globePoint.scale, {
      z: 1.4, // 0.8 * 2
      duration: 2,
      yoyo: true, // yoyos between 0 to 0.8
      repeat: -1, // -1 means repeat inifinitely in gsap
      ease: 'linear',
      delay: Math.random(), // all the points rises at different times
    })

    // after importing json file, set to country.property
    globePoint.year = operation.year;
    globePoint.name = operation.name;

  })

}

createGlobePoints(operations);

sphere.rotation.y = -Math.PI / 2

// offset default is 0
group.rotation.offset = {
  x: 0,
  y: 0
}


/**
 * Mouse - needs to be above animation
*/

const mouse = {
  x: undefined,
  y: undefined,
  down: false,
  xPrev: undefined,
  yPrev: undefined
}

// console.log(group.children);


/**
 * Raycaster
*/

const raycaster = new THREE.Raycaster();

// console.log(raycaster);
// console.log(scene.children);
// console.log(group.children.filter((mesh) => {
// return mesh.geometry.type === 'BoxGeometry'
// }))

const popupLabel = document.querySelector('#popupLabel');
const yearEl = document.querySelector('#yearEl');
const nameEl = document.querySelector('#nameEl');


/**
 * Animation
*/

function animate() {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
  // sphere.rotation.y += 0.003;
  // group.rotation.y += 0.003; // has to be group or otherwise globePoint will not rotate with sphere
  // group.rotation.y = mouse.x * 0.5;

  // adds delay animation to our mousemove
  // if (mouse.x) {
  //   gsap.to(group.rotation, {
  //     x: - mouse.y * 1.8,
  //     y: mouse.x * 1.8,
  //     duration: 2
  //   })
  // }

  // update picking ray with the camera mouse and position
  raycaster.setFromCamera(mouse, camera)

  // calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(
    group.children.filter((mesh) => {
      return mesh.geometry.type === 'BoxGeometry'
    })
  ) // instead of scene.children

  group.children.forEach((mesh) => {
    mesh.material.opacity = 0.4
  })

  gsap.set(popupLabel, {
    display: 'none'
  })

  for (let i = 0; i < intersects.length; i++) {
    // console.log('mouse hover')
    // globePoint we're hovering over
    const globePoint = intersects[i].object;
    globePoint.material.opacity = 1
    gsap.set(popupLabel, {
      display: 'block'
    })

    console.log(globePoint)

    yearEl.innerHTML = globePoint.year;
    nameEl.innerHTML = globePoint.name;
  }

  renderer.render(scene, camera)

}
animate();


/**
 * Mouse Events - Desktop
*/

// add another event listener for when the mouse is pressed in the canvas container with the globe
// for click and drag functionality - not the window object (with text)
canvasContainer.addEventListener('mousedown', ({ clientX, clientY }) => {
  mouse.down = true;
  mouse.xPrev = clientX;
  mouse.yPrev = clientY;
})

addEventListener('mousemove', (event) => {

  // mobile responsive
  if (innerWidth >= 1280) {
    mouse.x = ((event.clientX - innerWidth / 2) / (innerWidth / 2)) * 2 - 1
    mouse.y = -(event.clientY / innerHeight) * 2 + 1
  } else {
    const offset = canvasContainer.getBoundingClientRect().top
    mouse.x = (event.clientX / innerWidth) * 2 - 1
    mouse.y = -((event.clientY - offset) / innerHeight) * 2 + 1
  }
  

  gsap.set(popupLabel, {
    x: event.clientX,
    y: event.clientY
  })

  if (mouse.down) {
    // console.log('turn earth')
    event.preventDefault(); // prevents text from highlighting when text is overglobe.
    const deltaX = event.clientX - mouse.xPrev;
    const deltaY = event.clientY - mouse.yPrev;

    group.rotation.offset.x += deltaY * 0.005;
    group.rotation.offset.y += deltaX * 0.005;

    gsap.to(group.rotation, {
      x: group.rotation.offset.x,
      y: group.rotation.offset.y,
      duration: 2
    })

    // group.rotation.x += deltaY * 0.005;
    // group.rotation.y += deltaX * 0.005;
    mouse.xPrev = event.clientX;
    mouse.yPrev = event.clientY;
  }
})

addEventListener('mouseup', () => {
  mouse.down = false;
})


/**
 * Mobile Responsive
*/

// 3D scene responsiveness
addEventListener('resize', () => {
  renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);

  camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.offsetWidth / canvasContainer.offsetHeight,
    0.1,
    1000
  )
  camera.position.y = 0;
  camera.position.z = 11;
})

// touch screen for mobile
addEventListener('touchmove', (event) => {

  event.clientX = event.touches[0].clientX;
  event.clientY = event.touches[0].clientY;

  // check if touch on screen intersects with sphere with raycaster
  const doesIntersect = raycaster.intersectObject(sphere)
  // console.log(doesIntersect)
  if (doesIntersect.length > 0) mouse.down = true;

  // mobile responsive
  if (mouse.down) {
    
    const offset = canvasContainer.getBoundingClientRect().top
    mouse.x = (event.clientX / innerWidth) * 2 - 1
    mouse.y = -((event.clientY - offset) / innerHeight) * 2 + 1
  

    gsap.set(popupLabel, {
      x: event.clientX,
      y: event.clientY
    })

    event.preventDefault(); // prevents text from highlighting when text is over globe
    // console.log('turn the earth')
    const deltaX = event.clientX - mouse.xPrev;
    const deltaY = event.clientY - mouse.yPrev;

    group.rotation.offset.x += deltaY * 0.005;
    group.rotation.offset.y += deltaX * 0.005;

    gsap.to(group.rotation, {
      x: group.rotation.offset.x,
      y: group.rotation.offset.y,
      duration: 2
    })

    // group.rotation.x += deltaY * 0.005;
    // group.rotation.y += deltaX * 0.005;

    mouse.xPrev = event.clientX;
    mouse.yPrev = event.clientY;
  }
},
  {passive: false}
)

addEventListener('touchend', () => {
  mouse.down = false;
})


