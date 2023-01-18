// TODO: instead of outputting the index as a color, output an image with the uv offsets

// 5 pairs of UV voronoi points, 10 vor points total
// the fact that is 10 points is hard coded
@binding(0) @group(0) var<uniform> vorPointBuf : array<vec4<f32>, 5>;
@binding(1) @group(0) var Sampler: sampler;
@binding(2) @group(0) var Texture: texture_2d<f32>;

// calculates the distance to the nearest voronoi point
// the index of the point it is closest to determines its color
@fragment
fn main(
    @location(0) fragUV: vec2<f32>,
    @location(1) fragPosition: vec4<f32>
) -> @location(0) vec4<f32> {

    // compare to each point in voronoi points buffer
    var min_dist = 2.0; // bigger than any possible value
    var index:f32 = 0.0;
    for(var i: i32 = 0; i < 5; i++) {
        var diff:vec2<f32> = fragUV - vec2(vorPointBuf[i][0], vorPointBuf[i][1]);
        var dist:f32 = length(diff);
        if dist < min_dist {
            min_dist = dist;
            index = f32(i) * 2.0;
        }
        diff = fragUV - vec2(vorPointBuf[i][2], vorPointBuf[i][3]);
        dist = length(diff);
        if dist < min_dist {
            min_dist = dist;
            index = ( f32(i) * 2.0 ) + 1.0;
        }
    }
    var uvCoord = fragUV + ((vec2(index * 0.1, ((index * index) % 10) * 0.1)) * 0.1);
    uvCoord[0] = uvCoord[0] % 1.0;
    uvCoord[1] = uvCoord[1] % 1.0;
    return textureSample( Texture, Sampler, uvCoord );
}