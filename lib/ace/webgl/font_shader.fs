precision mediump float;

uniform sampler2D texture;
varying vec2 vCharacterOffset;
varying vec3 vcolor;

void main(void) {
    vec2 pos = vec2(gl_PointCoord.x, 1.0-gl_PointCoord.y);
    float alpha = texture2D(texture, pos * (12.0/256.0) + vCharacterOffset).a;
    if(alpha == 0.0) discard; // check if this yields performance
    gl_FragColor = vec4(vcolor, alpha);
}
