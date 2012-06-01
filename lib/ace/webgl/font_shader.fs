precision mediump float;

uniform sampler2D texture0;
uniform sampler2D texture1;
uniform float uPointSize;
uniform float uUpsidedown;
uniform float uTextureSize;

varying vec2 vCharacterOffset;
varying vec3 vcolor;
varying float vSecondTexture;

void main(void) {
    vec2 pos;
    if(uUpsidedown == 0.0)
      pos = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
    else
      pos = vec2(gl_PointCoord.x, gl_PointCoord.y);
    float alpha = 0.0;
    if(vSecondTexture == 0.0)
      alpha = texture2D(texture0, pos * (uPointSize/uTextureSize) + vCharacterOffset).a;
    else
      alpha = texture2D(texture1, pos * (uPointSize/uTextureSize) + vCharacterOffset).a;
    if(alpha == 0.0) discard; // check if this yields performance
    gl_FragColor = vec4(vcolor, alpha);
}
