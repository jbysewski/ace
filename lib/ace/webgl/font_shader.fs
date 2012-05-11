precision mediump float;

uniform sampler2D texture;
uniform float drawFull;
varying vec2 voffset;
varying vec3 vcolor;

void main(void) {
    //gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    vec2 pos = vec2(gl_PointCoord.x, gl_PointCoord.y);
    if(drawFull > 0.0)
       gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * texture2D(texture, pos);
    else
       gl_FragColor = vec4(vcolor, 0.0) + texture2D(texture, pos * (12.0/256.0) + voffset);
}