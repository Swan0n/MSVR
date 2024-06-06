'use strict';

let gl;                         // The webgl context.
let surface, sphere;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let sp = { a: 0.5, b: 0.5 }
let minLimitV = -1
let maxLimitV = 1
let virtualCamera;
let textureWebcam;
let webcam;
let texture;
let background;
function CreateWebcamTexture() {
    textureWebcam = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureWebcam);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function CreateCamera() {
    webcam = document.createElement('video');
    webcam.setAttribute('autoplay', true);
    navigator.getUserMedia({ video: true, audio: false }, function(stream) {
        webcam.srcObject = stream;
    }, function(e) {
        console.error('Rejected!', e);
    });
}
let audio = null;
let context, mediaSource, notchReject, panner;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function initAC() {
    audio = document.getElementById('audioToReject');

    audio.addEventListener('play', () => {
        if (!context) {
            context = new AudioContext();
            mediaSource = context.createMediaElementSource(audio);
            panner = context.createPanner();
            notchReject = context.createBiquadFilter();

            mediaSource.connect(panner);
            panner.connect(notchReject);
            notchReject.connect(context.destination);

            notchReject.type = 'notch';
            notchReject.Q.value = 0.1;
            notchReject.frequency.value = 12345;
            context.resume();
        }
    })


    audio.addEventListener('pause', () => {
        console.log('pause');
        context.resume();
    })
    let notchRejectEnabled = document.getElementById('notchRejectEnabled');
    notchRejectEnabled.addEventListener('change', function() {
        if (notchRejectEnabled.checked) {
            panner.disconnect();
            panner.connect(highpass);
            highpass.connect(context.destination);
        } else {
            panner.disconnect();
            panner.connect(context.destination);
        }
    });
    audio.play();
}

function audioPosition() {
    // Convert angles to radians
    const alphaRad = alpha
    const betaRad = beta
    const gammaRad = gamma

    // Define the initial vector along the x-axis
    let vector = [0, 1, 0];

    // Rotation around the z-axis (gamma)
    const rotZ = [
        [Math.cos(gammaRad), -Math.sin(gammaRad), 0],
        [Math.sin(gammaRad), Math.cos(gammaRad), 0],
        [0, 0, 1]
    ];
    vector = multiplyMatrixVector(rotZ, vector);

    // Rotation around the y-axis (beta)
    const rotY = [
        [Math.cos(betaRad), 0, Math.sin(betaRad)],
        [0, 1, 0],
        [-Math.sin(betaRad), 0, Math.cos(betaRad)]
    ];
    vector = multiplyMatrixVector(rotY, vector);

    // Rotation around the x-axis (alpha)
    const rotX = [
        [1, 0, 0],
        [0, Math.cos(alphaRad), -Math.sin(alphaRad)],
        [0, Math.sin(alphaRad), Math.cos(alphaRad)]
    ];
    vector = multiplyMatrixVector(rotX, vector);

    return vector;
}

function multiplyMatrixVector(matrix, vector) {
    const result = [];
    for (let i = 0; i < matrix.length; i++) {
        let sum = 0;
        for (let j = 0; j < vector.length; j++) {
            sum += matrix[i][j] * vector[j];
        }
        result.push(sum);
    }
    return result;
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, ts) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ts), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTBuffer);
        gl.vertexAttribPointer(shProgram.iAttribT, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribT);

        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw(callback = false) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
    gl.uniform3fv(shProgram.iP, [...dingDongSurface(sp.a, sp.b)]);
    gl.uniform2fv(shProgram.iSP, [mapRange(sp.a, 0, 2 * PI, 0, 1), mapRange(sp.b, minLimitV, maxLimitV, 0, 1)]);
    gl.uniform1f(shProgram.iScale, parseFloat(document.getElementById("scl").value));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, m4.translation(...audioPosition()));
    if (panner) {
        panner.setPosition(...audioPosition())
    }
    // gl.bindTexture(gl.TEXTURE_2D, textureWebcam);
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webcam);
    // background.Draw();
    // gl.bindTexture(gl.TEXTURE_2D, texture);
    sphere.Draw()
    // gl.clear(gl.DEPTH_BUFFER_BIT);

    let cRange = document.getElementById('c')
    let eRange = document.getElementById('e')
    let fRange = document.getElementById('f')
    let nRange = document.getElementById('n')
    virtualCamera.Convergence = parseFloat(cRange.value)
    virtualCamera.EyeSeparation = parseFloat(eRange.value)
    virtualCamera.FOV = parseFloat(fRange.value)
    virtualCamera.NearClippingDistance = parseFloat(nRange.value)
    virtualCamera.ApplyLeftFrustum();
    let compassRotationMatrix = m4.yRotation(deg2rad(heading));
    let deviceOrienationMatrix = m4.multiply(m4.multiply(m4.xRotation(beta), m4.yRotation(gamma)), m4.zRotation(alpha));
    modelViewProjection = m4.multiply(virtualCamera.projection, m4.multiply(virtualCamera.modelview, m4.multiply(matAccum1, deviceOrienationMatrix)));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(true, false, false, false);
    surface.Draw();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    virtualCamera.ApplyRightFrustum();
    modelViewProjection = m4.multiply(virtualCamera.projection, m4.multiply(virtualCamera.modelview, m4.multiply(matAccum1, deviceOrienationMatrix)));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(false, true, true, false);
    surface.Draw();
    gl.colorMask(true, true, true, true);



    // gl.uniform4fv(shProgram.iColor, [0, 1, 0, 1]);
    // sphere.Draw();
    if (callback) {
        window.requestAnimationFrame(() => draw(true));
    }
}

function update() {
    minLimitV = -parseFloat(document.getElementById('low').value)
    surface.BufferData(CreateSurfaceData(), CreateTData());
    draw()
}


function CreateSurfaceData() {
    let vertexList = [];
    let numberOfSteps = parseInt(document.getElementById('num').value)
    let vStep = (maxLimitV - minLimitV) / numberOfSteps
    let uStep = 0.1
    for (let v = minLimitV; v < maxLimitV; v += vStep) {
        for (let u = 0; u < 2 * PI; u += uStep) {
            vertexList.push(...dingDongSurface(u, v))
            vertexList.push(...dingDongSurface(u + uStep, v))
            vertexList.push(...dingDongSurface(u, v + vStep))
            vertexList.push(...dingDongSurface(u, v + vStep))
            vertexList.push(...dingDongSurface(u + uStep, v))
            vertexList.push(...dingDongSurface(u + uStep, v + vStep))
        }
    }

    return vertexList;
}

function CreateTData() {
    let vertexList = [];
    minLimitV = -parseFloat(document.getElementById('low').value)
    let numberOfSteps = parseInt(document.getElementById('num').value)
    let vStep = (maxLimitV - minLimitV) / numberOfSteps
    let uStep = 0.1
    for (let v = minLimitV; v < maxLimitV; v += vStep) {
        for (let u = 0; u < 2 * PI; u += uStep) {
            vertexList.push(mapRange(u, 0, 2 * PI, 0, 1), mapRange(v, minLimitV, maxLimitV, 0, 1))
            vertexList.push(mapRange(u + uStep, 0, 2 * PI, 0, 1), mapRange(v, minLimitV, maxLimitV, 0, 1))
            vertexList.push(mapRange(u, 0, 2 * PI, 0, 1), mapRange(v + vStep, minLimitV, maxLimitV, 0, 1))
            vertexList.push(mapRange(u, 0, 2 * PI, 0, 1), mapRange(v + vStep, minLimitV, maxLimitV, 0, 1))
            vertexList.push(mapRange(u + uStep, 0, 2 * PI, 0, 1), mapRange(v, minLimitV, maxLimitV, 0, 1))
            vertexList.push(mapRange(u + uStep, 0, 2 * PI, 0, 1), mapRange(v + vStep, minLimitV, maxLimitV, 0, 1))
        }
    }

    return vertexList;
}

function mapRange(value, a, b, c, d) {
    // first map value from (a..b) to (0..1)
    value = (value - a) / (b - a);
    // then map it from (0..1) to (c..d) and return it
    return c + value * (d - c);
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribT = gl.getAttribLocation(prog, "texture");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iP = gl.getUniformLocation(prog, "p");
    shProgram.iSP = gl.getUniformLocation(prog, "sp");
    shProgram.iScale = gl.getUniformLocation(prog, "scl");

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData(), CreateTData());
    sphere = new Model('Sphere')
    sphere.BufferData(CreateSphereSurfaceData(), CreateSphereSurfaceData())
    background = new Model('Plane')
    background.BufferData(CreatePlaneSurfaceData(), CreatePlaneTextureData())

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

const { cos, sin, sqrt, PI } = Math

function r(v) {
    return v * sqrt(1 - v)
}
function x(u, v) {
    return r(v) * cos(u)
}
function y(u, v) {
    return r(v) * sin(u)
}
function z(v) {
    return v;
}

function dingDongSurface(u, v) {
    return [x(u, v), y(u, v), z(v)]
}

function CreateSphereSurfaceData() {
    let vertexList = [];

    let u = 0,
        t = 0;
    while (u < Math.PI * 2) {
        while (t < Math.PI) {
            let v = sphereSurface(u, t);
            let w = sphereSurface(u + 0.1, t);
            let wv = sphereSurface(u, t + 0.1);
            let ww = sphereSurface(u + 0.1, t + 0.1);
            vertexList.push(v.x, v.y, v.z);
            vertexList.push(w.x, w.y, w.z);
            vertexList.push(wv.x, wv.y, wv.z);
            vertexList.push(wv.x, wv.y, wv.z);
            vertexList.push(w.x, w.y, w.z);
            vertexList.push(ww.x, ww.y, ww.z);
            t += 0.1;
        }
        t = 0;
        u += 0.1;
    }
    return vertexList
}
const radius = 0.1;
function sphereSurface(long, lat) {
    return {
        x: radius * Math.cos(long) * Math.sin(lat),
        y: radius * Math.sin(long) * Math.sin(lat),
        z: radius * Math.cos(lat)
    }
}

function CreatePlaneSurfaceData() {
    const vertices = [
        [-1, -1, 0],
        [1, 1, 0],
        [1, -1, 0],
        [-1, 1, 0]
    ]
    const indices = [0, 1, 2, 1, 0, 3]
    let vertexList = []
    indices.forEach(i => {
        vertexList.push(...vertices[i])
    })
    return vertexList;
}
function CreatePlaneTextureData() {
    const textures = [
        [1, 1],
        [0, 0],
        [0, 1],
        [1, 0]]
    const indices = [0, 1, 2, 1, 0, 3]
    let textureList = []
    indices.forEach(i => {
        textureList.push(...textures[i])
    })
    return textureList;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    virtualCamera = new StereoCamera(10, 2, 1, 40, 0.1, 40);
    // CreateCamera()
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        LoadTexture();
        // CreateWebcamTexture();
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw(true);
}

function LoadTexture() {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const image = new Image();
    image.crossOrigin = 'anonymus';
    image.src = "https://raw.githubusercontent.com/Swan0n/VISUALIZATION/CGW/photo.png";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        console.log("imageLoaded")
        draw()
    }
}

window.onkeydown = (e) => {
    if (e.keyCode == 87) {
        sp.a = Math.min(sp.a + 0.1, Math.PI * 2);
    }
    else if (e.keyCode == 83) {
        sp.a = Math.max(sp.a - 0.1, 0);
    }
    else if (e.keyCode == 68) {
        sp.b = Math.min(sp.b + 0.1, 1);
    }
    else if (e.keyCode == 65) {
        sp.b = Math.max(sp.b - 0.1, minLimitV);
    }
    draw()
}
let heading = 0
let alpha = 0, beta = 0, gamma = 0;
function requestDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                console.log(response);
                if (response === 'granted') {
                    console.log('Permission granted');
                    window.addEventListener('deviceorientation', e => {

                        // do something here
                        alpha = deg2rad(e.alpha);
                        beta = deg2rad(e.beta);
                        gamma = deg2rad(e.gamma);
                        heading = e.webkitCompassHeading
                    }, true);
                }
            }).catch((err => {
                console.log('Err', err);
            }));
    } else
        console.log('not iOS');
}