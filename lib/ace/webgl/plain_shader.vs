attribute float index;
attribute vec2 aVertexPosition;

uniform vec2 uResolution;
uniform vec2 uOffset;

void main(void) {
    vec2 pos = (aVertexPosition + uOffset) / uResolution * 2.0 - 1.0;
    gl_Position = vec4(pos * vec2(1,-1), 0, 1);
}
