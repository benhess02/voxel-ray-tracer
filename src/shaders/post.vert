#version 300 es
in vec4 vPosition;
out vec2 uv;
void main() {
    uv = (vPosition.xy + 1.0) / 2.0;
    gl_Position = vPosition;
}