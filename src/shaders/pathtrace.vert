#version 300 es
uniform float filmGuage;
uniform vec2 outputSize;
in vec4 vPosition;
out vec2 cameraPoint;
out vec2 uv;
void main() {
    float scale = filmGuage / outputSize.x;
    uv = (vPosition.xy + 1.0) / 2.0;
    cameraPoint = (vPosition.xy / 2.0) * outputSize * scale;
    gl_Position = vPosition;
}