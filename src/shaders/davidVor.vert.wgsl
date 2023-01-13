// directly references the vertex buffer and returns the vert within that buffer that corresponds
// with this (instance?) of the shader 
@vertex
fn main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 1.0);
}