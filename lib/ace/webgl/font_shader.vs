attribute float index;
attribute vec2 aVertexPosition;
attribute vec3 color;

uniform vec2 uResolution;
uniform float pointSize;

varying vec2 voffset;
varying vec3 vcolor;

void main(void) {
    vec2 pos = aVertexPosition / uResolution * 2.0 - 1.0;
    gl_Position = vec4(pos * vec2(1,-1), 0, 1);
    gl_PointSize = pointSize;
    voffset = vec2(mod(index,16.0) / 16.0, floor(index/16.0) / 16.0);
    vcolor = color;
}