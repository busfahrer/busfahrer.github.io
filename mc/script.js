// TODO fix the hardcoded 36 on render call
// TODO fix on macos - might be related to arraybuffer length problem?
// TODO add cube deletion
// TODO FIME when placing blocks while looking into a slanted dir, after placing the block
// the highlighted block is wrong? It seems after that, placing a new one will be correct, but the highlight itself was wrong?
// TODO add tilt
// TODO add mouse!
// TODO highlight targeted cube/face
// TODO challenge: highlight only one face/surface
// TODO do something with the car
// TODO try different light color
// TODO you can set texture coords to e.g. 3.0 to get repeating texture on the same face
// TODO use materials from vp.mtl, e.g. for cessna
// TODO this version has fun physics!
// TODO add hovering flag to walls and then implement gravity for everything
// TODO somehow merge the menger sponge cubes into a single mesh to allow for rotation
// TODO convert player theta to vector, then add vertical looking
// TODO support quads in obj files and throw if more verts
// TODO allow picking objects with the mouse by projecting backwards from screen space and then shooting a ray
// https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-get-the-3d-coordinates-of-a-mouse-click.html

const { cos, sin, abs, atan2, floor, PI } = Math;
let gl;
const xAxis = vec3.fromValues(1.0, 0.0, 0.0);
const yAxis = vec3.fromValues(0.0, 1.0, 0.0);
const zAxis = vec3.fromValues(0.0, 0.0, 1.0);
let player;
let cube;
//let octahedron;
const GRAVITY = 0.001;
let meshes = [];
let keyMap = {};
let keyWentUpMap = {};
let teapot;
let bunny;
let minicooper;
let PLAYERSPEED = 0.03;
let light;
const zNear = 0.1;
const zFar = 100.0;
let canvas;
let rayStart;
let rayEnd;
let newPos;
let mouseX = 32;
let mouseY = 32;
let lastX = 0;
let lastY = 0;
let deltaX = 0;
let deltaY = 0;

let texture;
var vMatrix = mat4.create();
var mMatrix = mat4.create();
var nMatrix = mat4.create();
var pMatrix = mat4.create();

const getFrac = x => x - floor(x);
const isEqual = (a, b) => abs(a - b) < 0.0000001;

function getPlayerVec(player, dtheta = 0) {
  const dx = cos(player.theta + dtheta);
  const dz = sin(player.theta + dtheta);
  const playerVec = [-dx, 0, -dz];
  return playerVec;
}

function formatFloat(x) {
  return Math.round(x * 1000) / 1000;
}

function formatVec(obj) {
  return `(${formatFloat(obj[0])}, ${formatFloat(obj[1])}, ${formatFloat(obj[2])})`;
}

function add(a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2]
  ];
}

function mag(v) {
  return Math.sqrt(
    v[0]*v[0] +
    v[1]*v[1] +
    v[2]*v[2]
  );
}

function sub(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2]
  ];
}

function mult(v, factor) {
  return [
    v[0] * factor,
    v[1] * factor,
    v[2] * factor,
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(b, c) {
  // xyzzy:
  // ax = bycz - bzcy;
  // ay = bzcx - bxcz;
  // az = bxcy - bycx;
  return [
    b[1] * c[2] - b[2] * c[1],
    b[2] * c[0] - b[0] * c[2],
    b[0] * c[1] - b[1] * c[0],
  ];
}

function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be downloaded over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    width,
    height,
    border,
    srcFormat,
    srcType,
    pixel,
  );

  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      srcFormat,
      srcType,
      image,
    );

    // WebGL1 has different requirements for power of 2 images
    // vs. non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn off mips and set
      // wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  image.src = url;

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch (e) {
  }
  if (!gl) {
    alert("WebGL is not avaiable on your browser!");
  }
}

function getShader(gl, id) {
  var shaderScript = document.getElementById(id);
  if (!shaderScript) {
    return null;
  }

  var str = "";
  var k = shaderScript.firstChild;
  while (k) {
    if (k.nodeType == 3) {
      str += k.textContent;
    }
    k = k.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, str);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}


var shader_prog;

function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs");
  var vertexShader = getShader(gl, "shader-vs");

  shader_prog = gl.createProgram();
  gl.attachShader(shader_prog, vertexShader);
  gl.attachShader(shader_prog, fragmentShader);
  gl.linkProgram(shader_prog);

  if (!gl.getProgramParameter(shader_prog, gl.LINK_STATUS)) {
    alert("Could not initialise shaders");
  }

  gl.useProgram(shader_prog);

  shader_prog.positionLocation = gl.getAttribLocation(shader_prog, "aPosition");
  gl.enableVertexAttribArray(shader_prog.positionLocation);
  shader_prog.colorLocation = gl.getAttribLocation(shader_prog, "aColor");
  gl.enableVertexAttribArray(shader_prog.colorLocation);
  shader_prog.normalLocation = gl.getAttribLocation(shader_prog, "aNormal");
  gl.enableVertexAttribArray(shader_prog.normalLocation);
  shader_prog.textureCoordLocation = gl.getAttribLocation(shader_prog, "aTextureCoord");
  gl.enableVertexAttribArray(shader_prog.textureCoordLocation);

  shader_prog.uPerspLocation = gl.getUniformLocation(shader_prog, "uPersp");
  shader_prog.uModelLocation = gl.getUniformLocation(shader_prog, "uModel");
  shader_prog.uViewLocation = gl.getUniformLocation(shader_prog, "uView");
  shader_prog.uLightPosLocation = gl.getUniformLocation(shader_prog, "uLightPos");
  shader_prog.uLightColorLocation = gl.getUniformLocation(shader_prog, "uLightColor");
  shader_prog.uLightClqLocation = gl.getUniformLocation(shader_prog, "uLightClq");
  shader_prog.uNormalMatrixLocation = gl.getUniformLocation(shader_prog, "uNormalMatrix");
  shader_prog.uSamplerLocation = gl.getUniformLocation(shader_prog, "uSampler");
  shader_prog.uHighlightLocation = gl.getUniformLocation(shader_prog, "uHighlight");
}

function parseModel(modelData, scale = 1.0) {
  let vmin = [  Infinity,  Infinity,  Infinity ];
  let vmax = [ -Infinity, -Infinity, -Infinity ];

  const verticeLines = modelData.split("\n").filter(line => line.startsWith("v "));
  const textureCoordLines = modelData.split("\n").filter(line => line.startsWith("vt "));
  const normalLines = modelData.split("\n").filter(line => line.startsWith("vn "));

  const getIndicesAtOffset = idx => modelData.split("\n").filter(line => line.startsWith("f ")).flatMap(line =>
    line.substr(2).split(" ").filter(x => x).map(s => s.split("/")[idx]).map(x => parseInt(x, 10) - 1));

  const indices = getIndicesAtOffset(0);
  const textureCoordIndices = getIndicesAtOffset(1);
  const normalIndices = getIndicesAtOffset(2);
  let fixedVerticeLines = [];
  let fixedNormalLines = [];
  let fixedTextureCoordLines = [];
  indices.forEach(n => fixedVerticeLines.push(verticeLines[n]));
  if (textureCoordIndices.filter(Boolean).length === 0) {
    // TODO use some default here
    //throw new Error("ERROR: no texture coords!");
  } else {
    indices.forEach((n, idx) => fixedTextureCoordLines.push(textureCoordLines[textureCoordIndices[idx]]));
  }
  if (normalIndices.filter(Boolean).length === 0) {
    indices.forEach(n => fixedNormalLines.push(normalLines[n]));
  } else {
    indices.forEach((n, idx) => fixedNormalLines.push(normalLines[normalIndices[idx]]));
  }
  //console.log({fixedNormalLines});

  const vertices = fixedVerticeLines.flatMap(line => {
    const vert = line.substr(2).split(" ").filter(x => x).map(parseFloat).map(x => x * scale);
    vert.forEach((val, axisId) => {
      vmin[axisId] = val < vmin[axisId] ? val : vmin[axisId];
      vmax[axisId] = val > vmax[axisId] ? val : vmax[axisId];
    });
    return vert;
  });

  //const colors = vertices.map(x => Math.random());
  const colors = vertices.map(x => 0.5);
  //console.log({vertices, indices, normalIndices});
  const normals = fixedNormalLines.flatMap(line => line.substr(2).split(" ").filter(x => x).map(parseFloat));
  let textureCoords = [];
  //console.log({fixedTextureCoordLines});
  if (fixedTextureCoordLines.filter(Boolean).length !== 0) {
    //console.log("nonzero", fixedTextureCoordLines.filter(Boolean));
    try {
      // TODO handle non/wrong textures for minicooper model?
      textureCoords = fixedTextureCoordLines.flatMap(line => line.substr(2).split(" ").filter(x => x).map(parseFloat));
    } catch(e) {
      console.warn("XXX semi-tolerated error because model has no texture coordinates:", e);
    }
  }
  // texCoords have 72 instead of 108 because 2 parts instead of 3!
  //console.log({vertices, normals, textureCoords});
  if (normals.length === 0) {
    // TODO fix the case where obj has no normals
    throw new Error("ERROR: TODO: fix the case where obj has no normals");
  }
  if (normals.length !== vertices.length) {
    throw new Error("Sanity check failed: normals are not same length as verts!");
  }

  return {
    vertices,
    colors,
    normals,
    textureCoords,
    vmin,
    vmax,
    };
}

function makeMesh(obj) {
  const { vertices, colors, normals, textureCoords } = obj;
  const vertexBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const normalBuffer = gl.createBuffer();
  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  vertexBuffer.itemSize = 3;
  vertexBuffer.numItems = vertices.length;
  console.log(vertices.length);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  colorBuffer.itemSize = 3;
  colorBuffer.numItems = colors.length;

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  normalBuffer.itemSize = 3;
  //console.log("XXX vertices length", vertices.length);
  //console.log("XXX normals length", normals.length, normals.length / 3);
  normalBuffer.numItems = normals.length;

  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
  textureCoordBuffer.itemSize = 2;
  textureCoordBuffer.numItems = textureCoords.length;

  return {
    vertexBuffer,
    colorBuffer,
    normalBuffer,
    textureCoordBuffer,
    pos: [0, 0, 0],
    theta: 0.0,
    thetaX: 0.0,
    thetaZ: 0.0,
    ...obj,
  };
}

function makeWallData(width, thickness, axisIdx) {
  const w = width / 2;
  const t = thickness / 2;
  const x = axisIdx === 0 ? t : w;
  const y = axisIdx === 1 ? t : w;
  const z = axisIdx === 2 ? t : w;

  return `
v -${x} -${y}  ${z}
v  ${x} -${y}  ${z}
v -${x}  ${y}  ${z}
v  ${x}  ${y}  ${z}
v -${x}  ${y} -${z}
v  ${x}  ${y} -${z}
v -${x} -${y} -${z}
v  ${x} -${y} -${z}

vt 0.000000 0.000000
vt 9.000000 0.000000
vt 0.000000 9.000000
vt 9.000000 9.000000

vn  0.000000  0.000000  1.000000
vn  0.000000  1.000000  0.000000
vn  0.000000  0.000000 -1.000000
vn  0.000000 -1.000000  0.000000
vn  1.000000  0.000000  0.000000
vn -1.000000  0.000000  0.000000

g cube
usemtl cube
s 1
f 1/1/1 2/2/1 3/3/1
f 3/3/1 2/2/1 4/4/1
s 2
f 3/1/2 4/2/2 5/3/2
f 5/3/2 4/2/2 6/4/2
s 3
f 5/4/3 6/3/3 7/2/3
f 7/2/3 6/3/3 8/1/3
s 4
f 7/1/4 8/2/4 1/3/4
f 1/3/4 8/2/4 2/4/4
s 5
f 2/1/5 8/2/5 4/3/5
f 4/3/5 8/2/5 6/4/5
s 6
f 7/1/6 1/2/6 5/3/6
f 5/3/6 1/2/6 3/4/6
`;
}

function some(arr, fn = (x => x)) {
  return arr.reduce((acc, cur) => acc || fn(cur), false);
}

function inRange(x, min, max) {
  return x >= min && x <= max;
}

function pointIntersects(bigMesh, p) {
  const vmin = [
    bigMesh.vmin[0] + bigMesh.pos[0],
    bigMesh.vmin[1] + bigMesh.pos[1],
    bigMesh.vmin[2] + bigMesh.pos[2],
  ];
  const vmax = [
    bigMesh.vmax[0] + bigMesh.pos[0],
    bigMesh.vmax[1] + bigMesh.pos[1],
    bigMesh.vmax[2] + bigMesh.pos[2],
  ];

  const result = (
    inRange(p[0], vmin[0], vmax[0]) &&
    inRange(p[1], vmin[1], vmax[1]) &&
    inRange(p[2], vmin[2], vmax[2])
  );

  //debugger;
  if (result ) {
    //console.log("PI TRUE");
  }

  return result;

}

// TODO the limitation here is that at least one of the corners of the small mesh
// is expected to be inside the big mesh, which is only the case if the sizes are
// sufficiently different
function intersects(bigMesh, mesh) {
  const vmin = [
    mesh.vmin[0] + mesh.pos[0],
    mesh.vmin[1] + mesh.pos[1],
    mesh.vmin[2] + mesh.pos[2],
  ];
  const vmax = [
    mesh.vmax[0] + mesh.pos[0],
    mesh.vmax[1] + mesh.pos[1],
    mesh.vmax[2] + mesh.pos[2],
  ];

  const pts = [
    [ vmin[0], vmin[1], vmin[2] ],
    [ vmin[0], vmin[1], vmax[2] ],
    [ vmin[0], vmax[1], vmin[2] ],
    [ vmin[0], vmax[1], vmax[2] ],
    [ vmax[0], vmin[1], vmin[2] ],
    [ vmax[0], vmin[1], vmax[2] ],
    [ vmax[0], vmax[1], vmin[2] ],
    [ vmax[0], vmax[1], vmax[2] ],
  ];

  return some(pts, p => pointIntersects(bigMesh, p));
}

function findCollisions(meshes, player) {
  return some(meshes, m => m !== player && intersects(m, player));
}

// create 6 wall meshes, with a free space of
// width x width x width
// originating from 0/0/0, and a thickness of t
// going outward, i.e. viewed from the side
//  ###
// #   #
// #   #
// #   #
//  ###
function makeWallEnclosure(width, thickness) {
  const w = width;
  const t = thickness;
  const dist = width / 2 + t / 2;
  console.log(dist);
  const front = loadModel(makeWallData(w, t, 2));
  const back = loadModel(makeWallData(w, t, 2));
  front.pos[2] = dist;
  back.pos[2] = -dist;
  const top = loadModel(makeWallData(w, t, 1));
  const bottom = loadModel(makeWallData(w, t, 1));
  top.pos[1] = dist;
  bottom.pos[1] = -dist;
  const right = loadModel(makeWallData(w, t, 0));
  const left = loadModel(makeWallData(w, t, 0));
  right.pos[0] = dist;
  left.pos[0] = -dist;

  return [ front, back, top, bottom, right, left ];
}

function loadModel(modelData, scale) {
  return makeMesh(parseModel(modelData, scale));
}

function loadAndAddModel(meshes, modelData, pos = [0, 0, 0], scale = 1) {
  const mesh = loadModel(modelData, scale);
  mesh.pos = pos;
  meshes.push(mesh);
  return mesh;
}


function makeCubeAtHighlightedPosition() {
    makeAndAddCube(meshes, newPos);
}

function makeAndAddCube(meshes, pos, scale) {
  return loadAndAddModel(meshes, cubeData, pos, scale);
}

//this is just makeAndAddCube with width = scale because or cube has edge length 1
//function makeAndAddCubeFromTo(meshes, pos, width) {
  //const w = width;
  //return makeAndAddCube(meshes, pos, w);
//}
//
function makeAndAddMengerSponge(meshes, pos, scale = 1, level = 1) {
  const s = scale / 3;
  const range = [-1, 0, 1];
  range.forEach(x => {
    range.forEach(y => {
      range.forEach(z => {
        if ([x, y, z].filter(x => x).length <= 1) { // omit cube when 2 or more axis are 0, i.e. in the middle
              return;
        }
        console.log({x, y, z});
        const newPos = add(pos, [ x*s, y*s, z*s ]);
        const newLevel = level - 1;
        const addFunc = level > 1 ? makeAndAddMengerSponge : makeAndAddCube;
        addFunc(meshes, newPos, s);
      });
    });
  });
}

  // TODO: try to use this:
  // https://community.khronos.org/t/in-regard-to-ray-triangle-intersection/107616
  // to do the intersection

  // Check whether the intersect point is in triangle
function PointInOrOn(P1, P2, A, B) {
  // if the line from a corner point to the intersection point is between the to legs which are connected to the corner point
  const CP1 = cross(sub(B, A), sub(P1, A));
  const CP2 = cross(sub(B, A), sub(P2, A));

  // Return its result
  return dot(CP1, CP2) >= 0;
}

// Check whether the point is in triangle
function PointInTriangle(px, p1, p2, p3) {
  return PointInOrOn(px, p1, p2, p3) && PointInOrOn(px, p2, p3, p1) && PointInOrOn(px, p3, p1, p2);
}

// Check intersection point
function IntersectPlane(ray, p1, p2, p3) {
  // Direction
  // TODO
  // see main below, Dir is a directional vector from start to end
  const D = ray.dir;

  // The normal vector of the plane can be calculated by the cross product of 2 legs of the triangle
  const N = cross(sub(p3, p1), sub(p2, p1));

  // The intersection point X
  const X = add(ray.start, mult(D, dot(sub(p1, ray.start), N) / dot(D, N)));

  // Return coordinate of intersect point
  return X;
}

// Check intersection between given line and triangle + obtain coordinate of intersect point
function IntersectTriangle(ray, p1, p2, p3) {
  // Get coordinate of intersect point
  const point = IntersectPlane(ray, p1, p2, p3);

  // Check intersection
  const intersects = PointInTriangle(point, p1, p2, p3);
  return { intersects, point };
}


function drawMesh(mesh) {
  mat4.identity(mMatrix);
  mat4.translate(mMatrix, mMatrix, mesh.pos);
  mat4.rotate(mMatrix, mMatrix, mesh.theta, yAxis);
  mat4.rotate(mMatrix, mMatrix, mesh.thetaX, xAxis);
  mat4.rotate(mMatrix, mMatrix, mesh.thetaZ, zAxis);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
  gl.enableVertexAttribArray(shader_prog.positionLocation);
  gl.vertexAttribPointer(shader_prog.positionLocation, mesh.vertexBuffer.itemSize, gl.FLOAT, false, 3*4, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
  gl.enableVertexAttribArray(shader_prog.colorLocation);
  gl.vertexAttribPointer(shader_prog.colorLocation, mesh.colorBuffer.itemSize, gl.FLOAT, false, 3*4, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.enableVertexAttribArray(shader_prog.normalLocation);
  gl.vertexAttribPointer(shader_prog.normalLocation, mesh.normalBuffer.itemSize, gl.FLOAT, false, 3*4, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.textureCoordBuffer);
  gl.vertexAttribPointer(shader_prog.textureCoordLocation, mesh.textureCoordBuffer.itemSize, gl.FLOAT, false, 2*4, 0);
  gl.enableVertexAttribArray(shader_prog.textureCoordLocation);

  // calculate the normal matrix. This is the equivalent of the model matrix,
  // but for normals. Since normals are different, it has to be modified:
  // https://learnopengl.com/Lighting/Basic-Lighting
  mat4.identity(nMatrix);
  mat4.invert(nMatrix, mMatrix);
  mat4.transpose(nMatrix, nMatrix);



  // https://webglfundamentals.org/webgl/lessons/webgl-qna-how-to-get-the-3d-coordinates-of-a-mouse-click.html
  // project the mouse coordinates (currently just middle pixel of the canvas, not from the mouse)
  // into model space. The numbers seem to come out right!

  // gl_Position = uPersp * uView * uModel * vec4(aPosition, 1.0);
  // gl_Position = viewProjection * world * position
  //const invMat = m4.inverse(m4.multiply(viewProjection, world));
  let regMat = mat4.create();
  let invMat = mat4.create();
  let invMatView = mat4.create();
  let viewMat = mat4.create();
  //console.log({vMatrix, pMatrix});
  mat4.identity(regMat);
  mat4.identity(viewMat);

  const useRegular = 0; // 0 to skip model matrix for debug purposes

  mat4.multiply(viewMat, pMatrix, vMatrix);
  mat4.multiply(regMat, viewMat, mMatrix);
  if (useRegular) {
    mat4.invert(invMat, regMat); // TODO FIXME restore
  } else {
    mat4.invert(invMat, viewMat); // TODO FIXME restore
  }
  //mat4.invert(invMatView, viewMat); // TODO FIXME restore
  //mat4.invert(invMat, viewMat); // skipping the model matrix seems to work in projecting from clip space into world space
                                // why does model space not work? Maybe it works and the numbers are right?

  const rect = canvas.getBoundingClientRect();
  const x = rect.width / 2;//e.clientX - rect.left;
  const y = rect.height / 2;//e.clientY - rect.top;

  const clipX = mouseX / rect.width  *  2 - 1;
  const clipY = mouseY / rect.height * -2 + 1;
  //console.log({x, y, clipX, clipY});

  // TODO: glmatrix probably transformMat4(out, a, m) (see vec3 docs)
  // ATTENTION: w is 1 in this case, is this what we want???
  // 1 means point: https://gamedev.stackexchange.com/questions/64081/what-is-w-componet
  //const start = m4.transformPoint(invMat, [clipX, clipY, -1]);
  //const end   = m4.transformPoint(invMat, [clipX, clipY,  1]);
  const start = vec3.fromValues(0, 0, 0);
  const end = vec3.fromValues(0, 0, 0);
  rayStart = start;
  rayEnd = end;
  vec3.transformMat4(start, vec3.fromValues(clipX, clipY, -1), invMat);
  vec3.transformMat4(end, vec3.fromValues(clipX, clipY,  1), invMat);
  // NOTE: when you leave out the transformation to model space, the ray
  // goes from [0, -14.48483657836914, -96.99781036376953]
  // to        [0, -14.485058784484863, 2.8999998569488525]
  // i.e. z ranges from zNear to zFar (because player is at z == 0)
  //console.log({start, end});
  // Addendum: Is that right? note that one z is > 0, one z is < 0.


  //const startView = vec3.fromValues(0, 0, 0);
  //const endView = vec3.fromValues(0, 0, 0);
  //vec3.transformMat4(startView, vec3.fromValues(clipX, clipY, -1), invMatView);
  //vec3.transformMat4(endView, vec3.fromValues(clipX, clipY,  1), invMatView);

  //console.log({clipX, clipY, start, end, startView, endView, mMatrix});
  //console.log({clipX, clipY, start, end, mMatrix});
  //console.log("mv", mesh.vertices);
  // this sketches a full-fledged intersection, might not be needed for minecraft
  const verts = mesh.vertices;
  let intersections = [];
  for (let i = 0; i < verts.length; i += 9) {
    const ax = verts[i +  0];
    const ay = verts[i +  1];
    const az = verts[i +  2];

    const bx = verts[i +  3];
    const by = verts[i +  4];
    const bz = verts[i +  5];

    const cx = verts[i +  6];
    const cy = verts[i +  7];
    const cz = verts[i +  8];

    //const a = [ax, ay, az];
    //const b = [bx, by, bz];
    //const c = [cx, cy, cz];

    // TODO FIXME: world mapping not needed, duh?
    //const a = [ax, ay, az];
    //const b = [bx, by, bz];
    //const c = [cx, cy, cz];
    // TODO FIXME: but it IS needed when we have useRegular=0 above,
    // i.e. we only project from clip into world space, not into model space?
    const a = vec3.fromValues(0, 0, 0);
    const b = vec3.fromValues(0, 0, 0);
    const c = vec3.fromValues(0, 0, 0);
    vec3.transformMat4(a, vec3.fromValues(ax, ay, az), mMatrix);
    vec3.transformMat4(b, vec3.fromValues(bx, by, bz), mMatrix);
    vec3.transformMat4(c, vec3.fromValues(cx, cy, cz), mMatrix);
    //console.log({start, end, a});

    let ray = {};
    ray.start = start;
    ray.dir = sub(end, start);

    // Intersection check + obtain coordinate of intersection point
    // TODO use something like this to intersect on each face
    const rt = IntersectTriangle(ray, a, b, c);
    if (rt.intersects) {
      //const c = vec3.fromValues(0, 0, 0);
      //vec3.transformMat4(c, rt.point, mMatrix);
      //console.log(rt.point);
      // TODO check if point is in front of player
      //if (keyMap["w"]) { tryMovePlayer(meshes, player,  1, PI/2); }
      //if (keyMap["s"]) { tryMovePlayer(meshes, player, -1, PI/2); }
      //function tryMovePlayer(meshes, player, direction, dtheta) {

      //TODO rework this
      //const dtheta = PI/2;
      //const dx = cos(player.theta + dtheta);
      //const dz = sin(player.theta + dtheta);
      //const playerVec = add(player.pos, [-dx, 0, -dz]);
      //const pointVec = sub(rt.point, player.pos);
      //const dotResult = dot(playerVec, pointVec);

      // TODO using the angle doesnt work either
      // using the right vector now gives correct results,
      // but sometimes the list is empty?
      // bug is visible when pt = -0.1292036732051045
      // i.e. player theta is about -1.7
      // the error case without filtering gives us these rays
      //(-3.5, 0, 0.195)
      //(3.5, 0, -0.195)
      //(-4.5, 0, 0.325)
      //(4.5, 0, -0.325)
      //World Ray start/end
      //(-0.099, 0, 0.013)
      //(-99.164, 0, 12.884)

      //const vDelta = sub(c, player.pos);
      //const dx = vDelta[0];
      //const dz = vDelta[2];
      //const rad = atan2(dz, dx);
      //rayStart = [rad, player.theta, player.theta + PI/2];
      //rayEnd = c;
      //console.log({ pt: player.theta + PI/2, rad});
      //if (abs(rad - player.theta + PI/2) < PI) { intersections.push(c); }
      //intersections.push(c);

      const playerVec = getPlayerVec(player, PI/2);
      const pointVec = sub(rt.point, player.pos);
      const dotResult = dot(playerVec, pointVec);
      if (dotResult > 0) {
        intersections.push({ point: rt.point, mesh });
      }
    }
  }

  gl.uniformMatrix4fv(shader_prog.uPerspLocation, false, pMatrix);
  gl.uniformMatrix4fv(shader_prog.uViewLocation, false, vMatrix);
  gl.uniformMatrix4fv(shader_prog.uModelLocation, false, mMatrix);
  gl.uniformMatrix4fv(shader_prog.uNormalMatrixLocation, false, nMatrix);
  // TODO why is the left wall black???
  gl.uniform3fv(shader_prog.uLightPosLocation, vec3.fromValues(...light.pos));
  // https://wiki.ogre3d.org/tiki-index.php?page=-Point+Light+Attenuation
  // Range Constant Linear   Quadratic
  const attenuationConstants = {
   3250: [ 1.0,     0.0014,   0.000007 ],
    600: [ 1.0,     0.007,    0.0002 ],
    325: [ 1.0,     0.014,    0.0007 ],
    200: [ 1.0,     0.022,    0.0019 ],
    160: [ 1.0,     0.027,    0.0028 ],
    100: [ 1.0,     0.045,    0.0075 ],
     65: [ 1.0,     0.07,     0.017 ],
     50: [ 1.0,     0.09,     0.032 ],
     32: [ 1.0,     0.14,     0.07 ],
     20: [ 1.0,     0.22,     0.20 ],
     13: [ 1.0,     0.35,     0.44 ],
      7: [ 1.0,     0.7,      1.8 ],
  };
  const attenuationConstantFromRange = 325;
  //gl.uniform3fv(shader_prog.uLightClqLocation, vec3.fromValues(1.0, 0.022, 0.0019));
  gl.uniform3fv(shader_prog.uLightClqLocation, vec3.fromValues(...attenuationConstants[attenuationConstantFromRange]));
  gl.uniform3fv(shader_prog.uLightColorLocation, vec3.fromValues(1.0, 1.0, 1.0));

  // Tell WebGL we want to affect texture unit 0
  gl.activeTexture(gl.TEXTURE0);

  // Bind the texture to texture unit 0
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Tell the shader we bound the texture to texture unit 0
  gl.uniform1i(shader_prog.uSamplerLocation, 0);

  gl.uniform1i(shader_prog.uHighlightLocation, mesh.highlight ? 1 : 0);

  //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  //gl.drawElements(gl.TRIANGLES, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
  gl.drawArrays(gl.TRIANGLES, 0, 36); // TODO FIXME: this fixes it on mac

  return intersections;
}


function tryMoveVec(meshes, m, dv) {
  const add = factor => dv.forEach((amount, axisIdx) => m.pos[axisIdx] += factor * amount);
  add(1);
  const ok = !findCollisions(meshes, m);
  if (!ok) {
    add(-1);
  }
  return ok;
}

function tryMove(meshes, m, axisIdx, amount) {
  const dv = [0, 0, 0];
  dv[axisIdx] = amount;
  return tryMoveVec(meshes, m, dv);
}

function tryMoveX(meshes, m, amount) { return tryMove(meshes, m, 0, amount); }
function tryMoveY(meshes, m, amount) { return tryMove(meshes, m, 1, amount); }
function tryMoveZ(meshes, m, amount) { return tryMove(meshes, m, 2, amount); }

function tryMovePlayer(meshes, player, direction, dtheta) {
  const dx = cos(player.theta + dtheta) * PLAYERSPEED * direction;
  const dz = sin(player.theta + dtheta) * PLAYERSPEED * direction;
  return tryMoveVec(meshes, player, [-dx, 0, -dz]);
}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.perspective(pMatrix, 45, gl.viewportWidth / gl.viewportHeight, zNear, zFar);

  //player.pos[2] += 0.01;
  // TODO: use glMatrix's lookAt may be possible?
  let invertedCamPos = vec3.fromValues(0, 0, 0);
  vec3.negate(invertedCamPos, player.pos);
  mat4.identity(vMatrix);
  mat4.rotate(vMatrix, vMatrix, player.theta, yAxis);

  // TODO de-duplicate this
  const playerVec = getPlayerVec(player);
  const normalizedPlayerVec = vec3.fromValues(0, 0, 0);
  vec3.normalize(normalizedPlayerVec, playerVec);

  mat4.rotate(vMatrix, vMatrix, player.verticalTheta, normalizedPlayerVec);
  mat4.translate(vMatrix, vMatrix, invertedCamPos);

  const playerDist = v => mag(sub(player.pos, v));
  const intersections = meshes.flatMap(drawMesh).sort((a, b) => {
    const da = playerDist(a.point);
    const db = playerDist(b.point);
    if (da < db) {
      return -1;
    } else if (da > db) {
      return 1;
    } else {
      return 0;
    }
  });

  //const intersectionText = intersections.length ? formatVec(intersections[0]) + "" : "---";
  const intersectionText = intersections.map(o => o.point).map(formatVec).join("<br>");
  // TODO don't show points behind us
  //document.getElementById("fps").innerHTML = intersectionText;
  //const worldRayText = formatVec(rayStart) + "<br>" + formatVec(rayEnd) + "<br>";
  ////// TODO don't show points behind us
  //document.getElementById("worldray").innerHTML = worldRayText;
  const p = intersections[0].point;
  //console.log({p});
  const isEdge = x => isEqual(getFrac(x), 0.5); //TODO fix float stuff? // TODO works for negative?
  const getEdgeAxisId = v => v.reduce((acc, cur, idx) => isEdge(cur) ? idx : acc, -1);
  const pAxisId = getEdgeAxisId(p);
  if (pAxisId === -1) {
    throw new Error(`invalid axis id for ${p}`);
  }
  const intCube = intersections[0].mesh;
  meshes.forEach(m => m.highlight = false);
  intCube.highlight = true;
  const diff = p[pAxisId] - intCube.pos[pAxisId];
  newPos = [...intCube.pos];
  newPos[pAxisId] += Math.round(diff * 2);
  //console.log({ p, pAxisId, intCubePos, newPos });
  if (keyWentUpMap.x) {
    console.log("X FIRST PRESSED");
    // TODO FIXME HACK
    // TODO FIXME HACK
    // TODO FIXME HACK
    keyWentUpMap.x = false;
    //makeAndAddCube(meshes, newPos);
    makeCubeAtHighlightedPosition();
  }

  //cube.pos[2] -= 0.019;
  //octahedron.theta += 0.01;
  player.theta += deltaX * 0.002;
  player.verticalTheta += deltaY * -0.002;
  if (keyMap["n"]) { player.verticalTheta -= 0.02; }
  if (keyMap["m"]) { player.verticalTheta += 0.02; }
  if (keyMap["q"]) { player.theta -= 0.02; }
  if (keyMap["e"]) { player.theta += 0.02; }
  if (keyMap[" "]) { player.fallSpeed = -0.03; }
  // TODO why is the Math.PI/2 needed for WS, but not AD, and not vice-versa?
  // TODO we even have collision, try jumping on cube!
  if (keyMap["w"]) { tryMovePlayer(meshes, player,  1, PI/2); }
  if (keyMap["s"]) { tryMovePlayer(meshes, player, -1, PI/2); }
  if (keyMap["a"]) { tryMovePlayer(meshes, player,  1, 0); }
  if (keyMap["d"]) { tryMovePlayer(meshes, player, -1, 0); }
  if (keyMap[" "]) { tryMoveY(meshes, player,  0.1); }
  if (keyMap["c"]) { tryMoveY(meshes, player, -0.1); }
  if (keyMap["i"]) { tryMoveZ(meshes, light, -0.1); }
  if (keyMap["k"]) { tryMoveZ(meshes, light,  0.1); }
  if (keyMap["j"]) { tryMoveX(meshes, light, -0.1); }
  if (keyMap["l"]) { tryMoveX(meshes, light,  0.1); }
  if (keyMap["o"]) { tryMoveY(meshes, light,  0.1); }
  if (keyMap["u"]) { tryMoveY(meshes, light, -0.1); }

  //tryMoveZ(meshes, teapot, -0.03);

  //cube.theta += 0.01;
  //cube2.theta += 0.01;
  //cube2.thetaZ += 0.014;
  //cube2.thetaX += 0.008;
  //if (tryMoveY(meshes, cube, -cube.fallSpeed)) {
    //cube.fallSpeed += GRAVITY;
  //} else {
    //cube.fallSpeed = cube.fallSpeed * -0.55;
  //}

  //teapot.theta += 0.02;

  //if (tryMoveY(meshes, player, -player.fallSpeed)) {
    //player.fallSpeed += GRAVITY;
  //} else {
    //player.fallSpeed = player.fallSpeed * -0.55;
  //}

  requestAnimationFrame(drawScene);
}

(function loadWebGL(){
  canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  mouseX = canvas.width / 2;
  mouseY = canvas.height / 2;

  initGL(canvas);
  initShaders();
  //TODO somehow new cube tex coords are strange?
  texture = loadTexture(gl, WOLFTEXTURES[0]);
  // Flip image pixels into the bottom-to-top order that WebGL expects.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  //textureCoordBuffer = initTextureBuffer(gl);

  player = loadModel(cubeData);
  Object.assign(player, {
    pos: [0, 0, 0],
    //theta: -1.7,
    theta: 0.0,
    verticalTheta: 0.0,
    fallSpeed: 0,
  });
  console.log({player});

  //cube2 = loadModel(cubeData);
  //cube = makeAndAddCube(meshes, [1.0, -14.0, -4], 1);
  //cube.dump = true;
  ////makeAndAddMengerSponge(meshes, [4.0, -13.3, -1], 3, 3);
  //console.log(meshes);

  //// load but don't add
  light = loadModel(cubeData);
  light.pos = [-3, 10, 10];
  //cube.fallSpeed = 0;
  //console.log(cube);
  //cube2.pos = [7.0, -13.5, -4];
  //cube2.theta = 1.0;
  ////octahedron = loadModel(octahedronData);
  ////console.log(octahedron);
  //console.log("01", pointIntersects(cube, [1, -2, -4]));
  ////octahedron.pos = [-2.0, -2.0, -6];
  ////octahedron.theta = 1.8;
  //meshes.push(cube2);
  ////meshes.push(octahedron);
  //// TODO the lighting problem seems to pertain to the walls mostly?
  //// maybe check normals?
  //meshes.push(...makeWallEnclosure(30, 5));
  //teapot = loadModel(teapotData, 0.01);
  //console.log({teapot});

  //teapot.pos = [-2, -13, -4];
  //meshes.push(teapot);
  //bunny = loadModel(bunnyData, 0.3);
  //bunny.pos = [-1.5, -15, -3];
  //meshes.push(bunny);
  //minicooper = loadModel(minicooperData, 0.03);
  //minicooper.pos = [-3.5, -14.8, -3];
  //minicooper.thetaX = -PI/2;
  //meshes.push(minicooper);

  // !!!!! this expects width to be odd
  const makeLevelData = width => {
    const w = width;
    const halfW = floor(w / 2);
    let result = [];
    const add = v => result.push(v);
    const addn = (n, val=1) => {
      for (let i = 0; i < n; i++) {
        add(val);
      }
    };
    addn(w*w);
    for (let i = 0; i < w-2; i++) {
      addn(w);
      for (let j = 0; j < w-2; j++) {
        add(1);
        addn(w-2, 0);
        add(1);
      }
      addn(w);
    }
    addn(w*w);

    return result;
  };

  let oldLevelData = [
    // ROOF
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,

    // Walls
    1, 1, 1, 1, 1,
    1, 0, 0, 0, 1, // irregular cube here
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1,

    // Walls
    1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1,

    // Walls
    1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1,

    // Floor
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
  ];

  const levelWidth = 11;
  const levelData = makeLevelData(levelWidth);

  const getOffset = (x, y, z) => (y * levelWidth * levelWidth + levelWidth * z + x);
  const halfW = floor(levelWidth / 2);

  const level = Array(levelWidth);
  for (let x = 0; x < levelWidth; x++) {
    level[x] = Array(levelWidth);
    for (let y = 0; y < levelWidth; y++) {
      level[x][y] = Array(levelWidth);
      for (let z = 0; z < levelWidth; z++) {
        const hasCube = levelData[getOffset(x, y, z)];
        level[x][y][z] = hasCube;
        if (hasCube) {
          const getSpaceOffset = v => (v - halfW);
          const pos = [x-halfW, y-halfW, z-halfW];
          const c = makeAndAddCube(meshes, pos);
          //if (x === 1 && z === 0 && y == 1) {
            //c.highlight = true;
          //}
        }
      }
    }
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  gl.enable(gl.DEPTH_TEST);

  drawScene();
})();

function makeCube() {
  console.log("make cube at newpos", newPos);
}

window.onkeydown = function(e) {
  keyMap[e.key] = true;
}
window.onkeyup = function(e) {
  keyMap[e.key] = false;
  keyWentUpMap[e.key] = true;
}

canvas.addEventListener('swipe', (e) => { console.log("swipe", e) });
canvas.addEventListener('touchstart', (e) => {
  //e.preventDefault();
  console.log("touchstart", e)
  const clientX = e.touches[0].clientX;
  const clientY = e.touches[0].clientY;
  //deltaX = lastX - e.touches[0].clientX;
  //deltaY = lastY - e.touches[0].clientY;
  lastX = clientX;
  lastY = clientY;
  console.log(clientX, clientY, deltaX, deltaY);
});
canvas.addEventListener('touchend', (e) => {
  //e.preventDefault();
  console.log("touchend", e); deltaX = 0; deltaY = 0;
});
//canvas.addEventListener('touchcancel', (e) => { e.preventDefault(); deltaX = 0; deltaY = 0; });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  //console.log('touchmove', e.touches[0].clientX);
  //const rect = canvas.getBoundingClientRect();
  //mouseX = e.clientX - rect.left;
  //mouseY = e.clientY - rect.top;
  const clientX = e.touches[0].clientX;
  const clientY = e.touches[0].clientY;
  deltaX = lastX - e.touches[0].clientX;
  deltaY = lastY - e.touches[0].clientY;
  lastX = clientX;
  lastY = clientY;
  console.log(clientX, clientY, deltaX, deltaY);
});

 canvas.addEventListener('mousemove', (e) => {
     const rect = canvas.getBoundingClientRect();
     mouseX = e.clientX - rect.left;
     mouseY = e.clientY - rect.top;
});

window.onclick = e => {
  makeCubeAtHighlightedPosition();
}
