import * as mat3 from "./mat3";
import * as vec3 from "./vec3";

import * as pathTracerVertex from "./shaders/pathtrace.vert";
import * as pathTracerFragment from "./shaders/pathtrace.frag";
import * as postVertex from "./shaders/post.vert";
import * as postFragment from "./shaders/post.frag";

var cvs = <HTMLCanvasElement>document.getElementById("cvs");
var gl = cvs.getContext("webgl2");
gl.getExtension("EXT_color_buffer_float");

var pointerDown = false;
var lastPointerX : number;
var lastPointerY : number;

var position = vec3.create(8.5, 8.5, 8.5);
var movement = vec3.create(0, 0, 0);
var rotationMatrix = mat3.create();
var pitch = 0;
var yaw = 0;

var vertexBuffer : WebGLBuffer;

var keys : string[] = [];

var voxelColorsTexture : WebGLTexture;

var pathTracerProgram : WebGLProgram;
var outputSizeLocation : WebGLUniformLocation;
var positionLocation : WebGLUniformLocation;
var rotationLocation : WebGLUniformLocation;
var voxelColorsLocation : WebGLUniformLocation;
var rngSeedLocation : WebGLUniformLocation;
var pathTracerFrameLocation : WebGLUniformLocation;
var focalLengthLocation : WebGLUniformLocation;
var focalDistanceLocation : WebGLUniformLocation;
var apatureSizeLocation : WebGLUniformLocation;
var frameCountLocation : WebGLUniformLocation;

var frameCount : number = 0;
var focalLength : number = 1.15;
var focalDistance : number = 2;
var apatureSize : number = 0;

var postProgram : WebGLProgram;
var frameLocation : WebGLUniformLocation;

var framebuffer : WebGLFramebuffer;
var frontTexture : WebGLTexture;
var backTexture : WebGLTexture;

function create3DTexture(width : number, height : number, depth : number,
        format : GLint, type : GLint, data : ArrayBufferView) : WebGLTexture {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, format, width, height, depth, 0, format, type, data);
    return texture;
}

function create2DTexture() : WebGLTexture {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

function compileShaderProgram(vertexSource : string, fragmentSource : string) : WebGLProgram {
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        throw new Error("Failed to compile vertex shader: " + gl.getShaderInfoLog(vertexShader));
    }

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        throw new Error("Failed to compile fragment shader: " + gl.getShaderInfoLog(fragmentShader));
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Failed to link shader program: " + gl.getProgramInfoLog(program));
    }

    var positionLocation = gl.getAttribLocation(program, "vPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);

    return program;
}

function initFramebuffer() : void {
    framebuffer = gl.createFramebuffer();
    frontTexture = create2DTexture();
    backTexture = create2DTexture();
}

function initShaderPrograms() : void {
    pathTracerProgram = compileShaderProgram(pathTracerVertex, pathTracerFragment);
    outputSizeLocation = gl.getUniformLocation(pathTracerProgram, "outputSize");
    positionLocation = gl.getUniformLocation(pathTracerProgram, "position");
    rotationLocation = gl.getUniformLocation(pathTracerProgram, "rotation");
    voxelColorsLocation = gl.getUniformLocation(pathTracerProgram, "voxelColors");
    rngSeedLocation = gl.getUniformLocation(pathTracerProgram, "rngSeed");
    pathTracerFrameLocation = gl.getUniformLocation(pathTracerProgram, "frame");
    focalLengthLocation = gl.getUniformLocation(pathTracerProgram, "focal_length");
    focalDistanceLocation = gl.getUniformLocation(pathTracerProgram, "focal_distance");
    apatureSizeLocation = gl.getUniformLocation(pathTracerProgram, "apature_size");
    frameCountLocation = gl.getUniformLocation(pathTracerProgram, "frameCount");

    postProgram = compileShaderProgram(postVertex, postFragment);
    frameLocation = gl.getUniformLocation(postProgram, "frame");
}

function init() : void {
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        1, 1,
        1, 1,
        -1, 1,
        -1, -1
    ]), gl.STATIC_DRAW);

    var voxelColorsData = new Uint8Array(16 * 16 * 16 * 4);
    for(var i = 0; i < 200; i++) {
        var index = Math.floor(Math.random() * (voxelColorsData.length / 4));
        voxelColorsData[index * 4] = Math.floor(Math.random() * 256);
        voxelColorsData[index * 4 + 1] = Math.floor(Math.random() * 256);
        voxelColorsData[index * 4 + 2] = Math.floor(Math.random() * 256);
        voxelColorsData[index * 4 + 3] = 0x10;
    }
    for(var i = 0; i < 10; i++) {
        var index = Math.floor(Math.random() * (voxelColorsData.length / 4));
        if(Math.random() < 0.5) {
            voxelColorsData[index * 4] = 0xFF;
            voxelColorsData[index * 4 + 1] = 0x80;
            voxelColorsData[index * 4 + 2] = 0x05;
        } else {
            voxelColorsData[index * 4] = 0xFF;
            voxelColorsData[index * 4 + 1] = 0xFF;
            voxelColorsData[index * 4 + 2] = 0xFF;
        }
        voxelColorsData[index * 4 + 3] = 0xFF;
    }
    voxelColorsTexture = create3DTexture(16, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, voxelColorsData);

    initShaderPrograms();
    initFramebuffer();
}

function updateSize() {
    cvs.width = cvs.clientWidth;
    cvs.height = cvs.clientHeight;
    gl.viewport(0, 0, cvs.width, cvs.height);

    var pixels = new Float32Array(cvs.width * cvs.height * 4);

    gl.bindTexture(gl.TEXTURE_2D, frontTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cvs.width, cvs.height, 0, gl.RGBA, gl.FLOAT, pixels);

    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cvs.width, cvs.height, 0, gl.RGBA, gl.FLOAT, pixels);

    frameCount = 0;
}

function update(time : DOMHighResTimeStamp) {
    requestAnimationFrame(t => update(t));

    vec3.set(movement, 0, 0, 0);
    if(keys.includes("w")) {
        vec3.addImm(movement, 0, 0, 0.05);
        frameCount = 0;
    }
    if(keys.includes("s")) {
        vec3.addImm(movement, 0, 0, -0.05);
        frameCount = 0;
    }
    if(keys.includes("a")) {
        vec3.addImm(movement, -0.05, 0, 0);
        frameCount = 0;
    }
    if(keys.includes("d")) {
        vec3.addImm(movement, 0.05, 0, 0);
        frameCount = 0;
    }
    if(keys.includes("shift")) {
        vec3.addImm(movement, 0, -0.05, 0);
        frameCount = 0;
    }
    if(keys.includes(" ")) {
        vec3.addImm(movement, 0, 0.05, 0);
        frameCount = 0;
    }

    if(keys.includes("+") && apatureSize < 0.5) {
        apatureSize = Math.min(apatureSize + 0.01, 0.5);
        frameCount = 0;
    }
    if(keys.includes("-") && apatureSize > 0) {
        apatureSize = Math.max(apatureSize - 0.01, 0);
        frameCount = 0;
    }

    if(keys.includes("arrowup") && focalDistance < 10) {
        focalDistance = Math.min(focalDistance + 0.1, 20);
        frameCount = 0;
    }
    if(keys.includes("arrowdown") && focalDistance > 0.1) {
        focalDistance = Math.max(focalDistance - 0.1, 0.1);
        frameCount = 0;
    }

    mat3.reset(rotationMatrix);
    mat3.rotateY(rotationMatrix, yaw);
    mat3.multiplyVec(rotationMatrix, movement);
    vec3.add(position, movement);

    mat3.reset(rotationMatrix);
    mat3.rotateX(rotationMatrix, pitch);
    mat3.rotateY(rotationMatrix, yaw);

    gl.useProgram(pathTracerProgram);

    gl.uniform2f(outputSizeLocation, cvs.width, cvs.height);
    gl.uniform3fv(positionLocation, position);
    gl.uniformMatrix3fv(rotationLocation, false, rotationMatrix);
    gl.uniform1f(focalLengthLocation, focalLength);
    gl.uniform1f(focalDistanceLocation, focalDistance);
    gl.uniform1f(apatureSizeLocation, apatureSize);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.uniform1i(pathTracerFrameLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, voxelColorsTexture);
    gl.uniform1i(voxelColorsLocation, 1);

    gl.uniform1i(frameCountLocation, frameCount);

    var rngSeed = Math.floor(Math.random() * 1000000000);
    gl.uniform1ui(rngSeedLocation, rngSeed);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frontTexture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);


    gl.useProgram(postProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frontTexture);
    gl.uniform1i(frameLocation, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    var tmp = frontTexture;
    frontTexture = backTexture;
    backTexture = tmp;

    frameCount += 1;
}

document.addEventListener("keydown", (ev) => {
    if(!keys.includes(ev.key.toLowerCase())) {
        keys.push(ev.key.toLowerCase());
    }
});

document.addEventListener("keyup", (ev) => {
    var index = keys.indexOf(ev.key.toLowerCase());
    if(index >= 0) {
        keys.splice(index, 1);
    }
});

cvs.addEventListener("pointerdown", (ev) => {
    pointerDown = true;
    lastPointerX = ev.clientX;
    lastPointerY = ev.clientY;
});

cvs.addEventListener("pointerup", (ev) => {
    pointerDown = false;
});

cvs.addEventListener("pointerleave", (ev) => {
    pointerDown = false;
});

function screenToRotation(x : number, y : number) : [number, number] {
    let cameraX = (x - (cvs.width / 2)) / (cvs.height / 2);
    let cameraY = ((cvs.height - y) - (cvs.height / 2)) / (cvs.height / 2);
    let d = Math.sqrt(focalLength * focalLength + cameraX * cameraX);
    return [Math.atan2(cameraX, focalLength), -Math.atan2(cameraY, d)];
}

cvs.addEventListener("pointermove", (ev) => {
    if(pointerDown) {
        let [newYaw, newPitch] = screenToRotation(ev.clientX, ev.clientY);
        let [oldYaw, oldPitch] = screenToRotation(lastPointerX, lastPointerY);
        yaw += oldYaw - newYaw;
        pitch += oldPitch - newPitch;
        if(pitch > Math.PI / 2) {
            pitch = Math.PI / 2;
        } else if(pitch < -Math.PI / 2) {
            pitch = -Math.PI / 2;
        }
        frameCount = 0;
        lastPointerX = ev.clientX;
        lastPointerY = ev.clientY;
    }
});

cvs.addEventListener("wheel", (ev) => {
    if(ev.deltaY > 0) {
        focalLength = Math.max(focalLength * 0.97, 0.3);
    } else {
        focalLength = Math.min(focalLength * 1.03, 20);
    }
    frameCount = 0;
});

init();

window.addEventListener("resize", () => updateSize());
updateSize();
update(0);