#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D frame;
in vec2 uv;
out vec4 color;
void main() {
    vec3 c = texture(frame, uv).xyz;
    color = vec4(pow(c.x, 1.0 / 2.2), pow(c.y, 1.0 / 2.2), pow(c.z, 1.0 / 2.2), 1.0);
}