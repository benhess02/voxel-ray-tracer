import * as mat3 from "./mat3";
import * as vec3 from "./vec3";

var cvs = <HTMLCanvasElement>document.getElementById("cvs");
var gl = cvs.getContext("webgl2");
gl.getExtension("EXT_color_buffer_float");

var pathTracerVertex = `#version 300 es
uniform vec2 outputSize;
in vec4 vPosition;
out vec2 cameraPoint;
out vec2 uv;
void main() {
    float aspectRatio = float(outputSize.x) / float(outputSize.y);
    cameraPoint = vec2(vPosition.x * aspectRatio, vPosition.y);
    uv = (vPosition.xy + 1.0) / 2.0;
    gl_Position = vPosition;
}`;

var pathTracerFragment = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec3 position;
uniform mat3x3 rotation;
uniform sampler3D voxelColors;
uniform vec2 outputSize;
uniform uint rngSeed;
uniform sampler2D frame;
uniform int frameCount;
in vec2 cameraPoint;
in vec2 uv;
out vec4 color;

uint rng_state;

uint pcg_hash(uint n)
{
    uint state = n * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

uint rand_uint() {
    rng_state = pcg_hash(rng_state);
    return rng_state;
}

float rand_float() {
    return float(rand_uint()) / float(4294967295u);
}

vec2 random_in_circle() {
    float angle = rand_float() * 6.28318530718;
    return vec2(cos(angle), sin(angle)) * sqrt(rand_float());
}

vec3 random_in_sphere() {
    float z = rand_float() * 2.0 - 1.0;
    float r = sqrt(1.0 - z * z);
    return vec3(random_in_circle() * r, z);
}

void main() {
    rng_state = rngSeed + uint(gl_FragCoord.y) * uint(outputSize.x) + uint(gl_FragCoord.x);

    vec3 direction = normalize(rotation * vec3(cameraPoint.x, cameraPoint.y, 1.5));
    vec3 ray_pos = position;
    ivec3 ray_vox = ivec3(position);
    vec4 voxel_color = texelFetch(voxelColors, ray_vox, 0);

    vec3 multiplier = vec3(1.0, 1.0, 1.0);
    vec3 output_color = vec3(0.0, 0.0, 0.0);

    for(int i = 0; i < 48; i++) {
        int next_x = ray_vox.x + (direction.x < 0.0 ? -1 : 1);
        int next_y = ray_vox.y + (direction.y < 0.0 ? -1 : 1);
        int next_z = ray_vox.z + (direction.z < 0.0 ? -1 : 1);

        int edge_x = ray_vox.x + (direction.x < 0.0 ? 0 : 1);
        int edge_y = ray_vox.y + (direction.y < 0.0 ? 0 : 1);
        int edge_z = ray_vox.z + (direction.z < 0.0 ? 0 : 1);
    
        float dist_x = abs((float(edge_x) - ray_pos.x) / direction.x);
        float dist_y = abs((float(edge_y) - ray_pos.y) / direction.y);
        float dist_z = abs((float(edge_z) - ray_pos.z) / direction.z);
    
        ivec3 next_vox = ray_vox;
        float dist;
        vec3 normal = vec3(0.0, 0.0, 0.0);

        if(dist_x <= dist_y && dist_x <= dist_z) {
            ray_pos += direction * dist_x;
            dist = dist_x;
            next_vox.x += direction.x < 0.0 ? -1 : 1;
            normal.x = direction.x < 0.0 ? 1.0 : -1.0;
        }
        else if(dist_y <= dist_x && dist_y <= dist_z) {
            ray_pos += direction * dist_y;
            dist = dist_y;
            next_vox.y += direction.y < 0.0 ? -1 : 1;
            normal.y = direction.y < 0.0 ? 1.0 : -1.0;
        }
        else {
            ray_pos += direction * dist_z;
            dist = dist_z;
            next_vox.z += direction.z < 0.0 ? -1 : 1;
            normal.z = direction.z < 0.0 ? 1.0 : -1.0;
        }

        if(next_vox.x < 0 || next_vox.y < 0 || next_vox.z < 0
            || next_vox.x > 15 || next_vox.y > 15 || next_vox.z > 15) {
            break;
        }

        vec4 next_voxel_color = texelFetch(voxelColors, next_vox, 0);

        if(next_voxel_color.w != 0.0) {
            if(next_voxel_color.w > 0.5) {
                output_color += multiplier * next_voxel_color.xyz * next_voxel_color.w * 3.0;
            }
            if(rand_float() < 0.01) {
                direction = normalize(direction + -2.0 * normal * dot(direction, normal));
            }
            else {
                multiplier *= pow(next_voxel_color.xyz, vec3(2.2, 2.2, 2.2));
                direction = normalize(normal + random_in_sphere());
            }
        }
        else {
            ray_vox = next_vox;
            voxel_color = next_voxel_color;
        }
    }
    vec3 old_color = texture(frame, uv).xyz;
    color = vec4(old_color + (output_color - old_color) * (1.0 / float(frameCount + 1)), 1.0);
}`;

var postVertex = `#version 300 es
in vec4 vPosition;
out vec2 uv;
void main() {
    uv = (vPosition.xy + 1.0) / 2.0;
    gl_Position = vPosition;
}`;

var postFragment = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D frame;
in vec2 uv;
out vec4 color;
void main() {
    vec3 c = texture(frame, uv).xyz;
    color = vec4(pow(c.x, 1.0 / 2.2), pow(c.y, 1.0 / 2.2), pow(c.z, 1.0 / 2.2), 1.0);
}`;

var position = vec3.create(8.5, 8.5, 8.5);
var movement = vec3.create(0, 0, 0);
var rotationMatrix = mat3.create();
var pitch = 0;
var roll = 0;
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
var frameCountLocation : WebGLUniformLocation;

var frameCount : number = 0;

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
    if(keys.includes("Shift")) {
        vec3.addImm(movement, 0, -0.05, 0);
        frameCount = 0;
    }
    if(keys.includes(" ")) {
        vec3.addImm(movement, 0, 0.05, 0);
        frameCount = 0;
    }

    if(keys.includes("q")) {
        yaw -= 0.02;
        frameCount = 0;
    }
    if(keys.includes("e")) {
        yaw += 0.02;
        frameCount = 0;
    }
    if(keys.includes("r")) {
        pitch -= 0.02;
        frameCount = 0;
    }
    if(keys.includes("f")) {
        pitch += 0.02;
        frameCount = 0;
    }
    if(keys.includes("c")) {
        roll -= 0.02;
        frameCount = 0;
    }
    if(keys.includes("z")) {
        roll += 0.02;
        frameCount = 0;
    }

    mat3.reset(rotationMatrix);
    mat3.rotateZ(rotationMatrix, roll);
    mat3.rotateX(rotationMatrix, pitch);
    mat3.rotateY(rotationMatrix, yaw);

    mat3.multiplyVec(rotationMatrix, movement);
    vec3.add(position, movement);


    gl.useProgram(pathTracerProgram);

    gl.uniform2f(outputSizeLocation, cvs.width, cvs.height);
    gl.uniform3fv(positionLocation, position);
    gl.uniformMatrix3fv(rotationLocation, false, rotationMatrix);

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
    if(!keys.includes(ev.key)) {
        keys.push(ev.key);
    }
});

document.addEventListener("keyup", (ev) => {
    var index = keys.indexOf(ev.key);
    if(index >= 0) {
        keys.splice(index, 1);
    }
});

init();

window.addEventListener("resize", () => updateSize());
updateSize();
update(0);