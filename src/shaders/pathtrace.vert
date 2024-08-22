#version 300 es
uniform vec2 outputSize;
in vec4 vPosition;
out vec2 cameraPoint;
out vec2 uv;
void main() {
    float aspectRatio = float(outputSize.x) / float(outputSize.y);
    cameraPoint = vec2(vPosition.x * aspectRatio, vPosition.y);
    uv = (vPosition.xy + 1.0) / 2.0;
    gl_Position = vPosition;
}