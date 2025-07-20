import "./style.css"
import { gsap } from "gsap"

import { Rendering } from "./rendering"

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { palettes, sinPalettes } from "./palettes";

let paletteKey = "blue"
let palette = palettes[paletteKey]
let sinPalette = sinPalettes[paletteKey]

// setting up
let rendering = new Rendering(document.querySelector("#canvas"), palette)
rendering.camera.position.y = 0.1;
rendering.camera.position.z = 0;

let controls = new OrbitControls(rendering.camera, rendering.canvas)

let uTime = { value: 0 };

// Init
let radius = 2/3
let rings = 40  //how many rings we want
let segments = 32  //how many segments or tubes we want in each ring
let totalInstances = rings * segments  //total segments count

let geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 2)
let instancedGeometry = (new THREE.InstancedBufferGeometry()).copy(geometry)
instancedGeometry.instanceCount = totalInstances

let aInstance = new Float32Array(totalInstances * 2)    //for angle and ring index

let i = 0
for(let ringI = 0; ringI < rings; ringI++)
for(let segmentI = 0; segmentI < segments; segmentI++){
  let angle = segmentI / segments  //range 0 to 1
  aInstance[i] = angle
  aInstance[i + 1] = ringI
  i += 2
}
instancedGeometry.setAttribute('aInstance', new THREE.InstancedBufferAttribute(aInstance, 2, false))

let vertexShader = glsl`
#define PI 3.141592653589793
uniform float uTime;

attribute vec2 aInstance;

varying vec2 vUv;
varying float vDepth;
varying float vAngle;

mat4 rotationMatrix(vec3 axis, float angle) {
	axis = normalize(axis);
	float s = sin(angle);
	float c = cos(angle);
	float oc = 1.0 - c;
	
	return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
				oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
				oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
				0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
	mat4 m = rotationMatrix(axis, angle);
	return (m * vec4(v, 1.0)).xyz;
}

void main(){
  vec3 transformed = position;

  float ringIndex = aInstance.y;
  float loop = 80.0;
  float zPos = mod(ringIndex * 2.0 - uTime * 15.0, 80.0);

  float angle = mod(aInstance.x + uTime * 0.1 + zPos * 0.01, 1.0);
  float radius = 10.0 + sin(zPos * 0.1 + angle * PI * 2.0 + uTime * 1.0) * 2.0;

  vec2 ringPos = vec2(cos(angle * PI * 2.0), sin(angle * PI * 2.0)) * radius;

  transformed.y += -0.5;
  transformed.y *= 1.2 + sin(angle * PI * 12.0 + zPos * 0.08) * 0.4;
  transformed.y += 0.5;

  transformed.y += 0.5;
  transformed.y *= 2.0;
  transformed.y += -0.5;

  transformed = rotate(transformed, vec3(0.0, 0.0, 1.0), PI * 0.5);  //rotating on z axis
  transformed = rotate(transformed, vec3(0.0, 1.0, 0.0), angle * PI * 2.0);   //rotating on y axis then to finally get every instance looking at center

  transformed.xz += ringPos;
  transformed.y += -zPos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);

  vAngle = angle;
  vDepth = zPos / loop;
  vUv = uv;
  if(position.y > 0.49999){
    vUv.y = 1.0;
  }
  if(position.y < -0.49999){
    vUv.y = 0.0;
  }
  
}
`
let fragmentShader = glsl`
#define PI 3.141592653589793

uniform float uTime;
uniform vec3 uBackground;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform vec3 uPalette3;
uniform float uPaletteOffset;

varying vec2 vUv;
varying float vDepth;
varying float vAngle;

// cosine based palette, 4 vec3 params
vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.283185*(c*t+d) );
}

void main(){
  vec3 color = vec3(0.0);
  color = vec3(vUv.y);

  float mixVal = vDepth + vAngle;
  vec3 colorPalette = palette(vUv.y + vDepth * 4.0 + uPaletteOffset + uTime, uPalette0,uPalette1 , uPalette2, uPalette3);
  color = mix(colorPalette, uBackground, cos(mixVal * PI * 4.0 + uTime * 2.0));

  color = mix(color, uBackground, vDepth);

  gl_FragColor = vec4(color, 1.0);
}
`

let material = new THREE.ShaderMaterial({
  fragmentShader,
  vertexShader,
  uniforms: {
    uTime: uTime,
    uBackground: {value: palette.BG},
    uPalette0: {value: sinPalette.c0},
    uPalette1: {value: sinPalette.c1},
    uPalette2: {value: sinPalette.c2},
    uPalette3: {value: sinPalette.c3},
    uPaletteOffset: {value: sinPalette.offset},
  }
})

let mesh = new THREE.Mesh(instancedGeometry, material)
mesh.frustumCulled = false
rendering.scene.add(mesh)

// Events

const tick = (t)=>{
  uTime.value = t 
  rendering.render()
}

gsap.ticker.add(tick)

