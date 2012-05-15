attribute float index;
attribute vec2 aVertexPosition;

uniform vec2 uResolution;
uniform float pointSize;

varying vec2 voffset;
varying vec3 vcolor;

#define TWO_18 262144.0
#define TWO_15 32768.0
#define TWO_12 4096.0
#define TWO_10 1024.0
#define TWO_6  64.0
#define TWO_5  32.0

void main(void) {
    vec2 pos = aVertexPosition / uResolution * 2.0 - 1.0;
    gl_Position = vec4(pos * vec2(1,-1), 0, 1);
    gl_PointSize = pointSize;
    float i = floor(index / TWO_18);
    voffset = vec2(mod(i,16.0) / 16.0, floor(i/16.0) / 16.0);

    float r = floor(index / TWO_12);
    float g = floor(index / TWO_6);
    float b = floor(index);
    vcolor = mod(vec3(r, g, b), TWO_6) / TWO_6;
}
