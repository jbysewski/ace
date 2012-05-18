precision mediump float;

uniform sampler2D texture;
varying vec2 vCharacterOffset;
varying vec3 vcolor;

void main(void) {
    vec2 pos = vec2(gl_PointCoord.x, 1.0-gl_PointCoord.y);
    gl_FragColor = vec4(vcolor, 0.0) + texture2D(texture, pos * (12.0/256.0) + vCharacterOffset);
}
