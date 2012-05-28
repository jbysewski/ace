precision mediump float;

uniform vec2 uResolution;
uniform vec4 uColor;
uniform vec4 uBorderColor;
uniform vec2 uMin;
uniform vec2 uMax;

void main(void) {
   float height = uResolution.y;
   if(gl_FragCoord.x < uMin.x || gl_FragCoord.y > (height - uMin.y) || gl_FragCoord.x > uMax.x || gl_FragCoord.y < (height - uMax.y)) 
      gl_FragColor = uBorderColor;
   else
      gl_FragColor = uColor; 
}
