#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec3 position;
uniform mat3x3 rotation;
uniform sampler3D voxelColors;
uniform vec2 outputSize;
uniform uint rngSeed;
uniform sampler2D frame;
uniform int frameCount;
uniform float focal_length;
uniform float focal_distance;
uniform float apature_size;
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

    vec3 focal_point = (vec3(cameraPoint, focal_length) / focal_length) * focal_distance;
    vec3 apature_point = vec3(random_in_circle() * apature_size, 0.0);

    vec3 direction = normalize(rotation * (focal_point - apature_point));
    vec3 ray_pos = position + (rotation * apature_point);
    ivec3 ray_vox = ivec3(ray_pos);
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
}