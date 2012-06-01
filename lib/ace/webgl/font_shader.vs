attribute float index;
attribute vec2 aVertexPosition;

uniform vec2 uResolution;
uniform vec2 uOffset;
uniform float uPointSize;

varying vec2 vCharacterOffset;
varying vec3 vcolor;
varying float vSecondTexture;

#define TWO_18 262144.0
#define TWO_17 131072.0
#define TWO_15 32768.0
#define TWO_12 4096.0
#define TWO_10 1024.0
#define TWO_6  64.0
#define TWO_5  32.0

void main(void) {
    vec2 pos = (aVertexPosition + uOffset) / uResolution * 2.0 - 1.0;
    gl_Position = vec4(pos * vec2(1,-1), 0, 1);
    gl_PointSize = uPointSize;
    float i = floor(index / TWO_17);
    if(i > 63.0)
      vSecondTexture = 1.0;
    else
      vSecondTexture = 0.0;
    vCharacterOffset = vec2(mod(i,8.0) / 8.0, floor(i/8.0) / 8.0);

    float r = floor(index / TWO_10);
    float g = floor(index / TWO_5);
    float b = floor(index);
    vcolor = mod(vec3(r, g, b), TWO_5) / TWO_5;
}
