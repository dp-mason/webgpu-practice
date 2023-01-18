// Step 1: pure uv coord
// Step 2: distance from passed in point
// Step 3: search list of random uv points and return color corresponding to distance to nearest

@fragment
fn main(
    @location(0) fragUV: vec2<f32>,
    @location(1) fragPosition: vec4<f32>
) -> @location(0) vec4<f32> {
    return fragPosition;
}