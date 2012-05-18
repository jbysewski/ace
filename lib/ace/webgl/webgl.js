
define(function(require, exports, module) {
"use strict";

var dom = require("../lib/dom");

var WebGL = function() {
   this.element = dom.createElement("canvas");
   this.init();

};

(function() {

   this.init = function() {
      var canvas = this.element;
      var gl = this.$gl = canvas.getContext("experimental-webgl",  { alpha: false });

      gl.clearColor(1.0, 1.0, 1.0, 0.0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      
      var FontShaderFS = require("ace/requirejs/text!./font_shader.fs");
      var FontShaderVS = require("ace/requirejs/text!./font_shader.vs");

      this.$fontShader = this.createProgram(FontShaderFS, FontShaderVS, 
           {index: "index", vertexPositionAttribute: "aVertexPosition"}, 
           {uResolution: "uResolution", pointSize: "pointSize", upsidedown: "uUpsidedown", uTexture: "texture", offset: "uOffset"});

      var QuadShaderFS = require("ace/requirejs/text!./quad_shader.fs");
      var QuadShaderVS = require("ace/requirejs/text!./quad_shader.vs");

      this.$quadShader = this.createProgram(QuadShaderFS, QuadShaderVS, 
           {vertexPositionAttribute: "aVertexPosition"}, 
           {uResolution: "uResolution", color: "uColor", offset: "uOffset"});
   };

   this.$ready = false;
   this.isReady = function() {
      return this.$ready;
   }

   this.resize = function() {
      this.$ready = false;
      var gl = this.$gl;
      var canvas = this.element;
      
      canvas.width = canvas.clientWidth;// = 1200;
      canvas.height = canvas.clientHeight;// = 1000;

      //console.log("Width: "+canvas.width+" Height: "+canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);  
      this.$ready = true;
   };

   this.clear = function() {
      this.$gl.clear(this.$gl.COLOR_BUFFER_BIT | this.$gl.DEPTH_BUFFER_BIT);
   };

   this.compileFragmentShader = function(source) {
      var gl = this.$gl;
      return this.$compileShader(gl.createShader(gl.FRAGMENT_SHADER), source);
   };

   this.compileVertexShader = function(source) {
      var gl = this.$gl;
      return this.$compileShader(gl.createShader(gl.VERTEX_SHADER), source);
   };

   this.$compileShader = function(shader, source) {
      var gl = this.$gl;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
         console.log(gl.getShaderInfoLog(shader));
         return null;
      }

      return shader;
   };

   this.createProgram = function(fs, vs, attributes, uniforms) {
      var gl = this.$gl;
      var shaderProgram;
      var fragmentShader = this.compileFragmentShader(fs);
      var vertexShader = this.compileVertexShader(vs);

      shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
         console.log("Could not initialize shaders");
      }

      var vertexAttribArrayIndices = [];
      for (var attribute in attributes) {
         if(attributes.hasOwnProperty(attribute)) {
            shaderProgram[attribute] = gl.getAttribLocation(shaderProgram, attributes[attribute]);
            vertexAttribArrayIndices.push(shaderProgram[attribute]);
         }
      }

      for (var uniform in uniforms) {
         if(attributes.hasOwnProperty(attribute)) {
            shaderProgram[uniform] = gl.getUniformLocation(shaderProgram, uniforms[uniform]);
         }
      }
      shaderProgram.bind = function() {
         for(var i=0; i<vertexAttribArrayIndices.length; i++) {
            gl.enableVertexAttribArray(vertexAttribArrayIndices[i]); 
         }
         gl.useProgram(shaderProgram);
      }
      return shaderProgram;
   };

   this.createFontTexture = function(width, height, fontname, fontsize) {
      return this.$createTextureFromCanvas(this.$createFontCanvas(width, height, fontname, fontsize));
   };

   this.$createFontCanvas = function(width, height, fontname, fontsize) {
      var imageCanvas = document.createElement( "canvas" );
      var ctx = imageCanvas.getContext( "2d" );
      imageCanvas.width = width;
      imageCanvas.height = height;      
      ctx.font = fontsize + 'px ' + fontname;

      var base = 32;
      ctx.fillStyle = '#000000';
    
       // for(var y=0; y<height; y+=2)
         //   for(var x = 0;x<width; x+=2)
           //     ctx.fillRect(x+0.5,y+0.5,0.5,0.5);
    
        
      for(var i = 0;i<128-base; i++){
         var x = i%16, y = Math.floor(i/16);
         var pX = Math.floor(x/16 * width)+0.5, pY = Math.floor(y/16 * height)+0.5;         
         ctx.fillText(String.fromCharCode(i+base),pX,pY+fontsize-3);  
      }
     
      return imageCanvas;
   };

   this.$createTextureFromCanvas = function(canvas) {
      var gl = this.$gl;
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.bindTexture(gl.TEXTURE_2D, null);

      return texture;
   };

   this.create2dGridVertices = function(sizex, sizey, width, height) {
      var gl = this.$gl;
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      var vertices = [];
      for(var y=0, i=0; y<height; y++) {
         for(var x=0; x<width; x++)
         {            
            vertices[i++] = x * sizex + sizex;
            vertices[i++] = y * sizey + sizey * 0.5;
         }
      }   

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      buffer.itemSize = 2;
      buffer.numItems = vertices.length / 2;   
      return buffer;
   };

   this.createQuadVertices = function(width, height) {
      var gl = this.$gl;
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      var vertices = [
         width, height,
         0,     height,
         width, 0,
         0,     0
      ];

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      buffer.itemSize = 2;
      buffer.numItems = 4;   
      return buffer;
   };

   this.drawPoints = function(vertexBuffer, shader) {
      var gl = this.$gl;

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.vertexAttribPointer(shader.vertexPositionAttribute, vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);           
      gl.uniform2f(shader.uResolution, this.element.width, this.element.height);

      gl.drawArrays(gl.POINTS, 0, vertexBuffer.numItems);

   };

   this.drawTriangleStrip = function(vertexBuffer, shader) {
      var gl = this.$gl;

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.vertexAttribPointer(shader.vertexPositionAttribute, vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);           
      gl.uniform2f(shader.uResolution, this.element.width, this.element.height);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexBuffer.numItems);
   };

   this.activateTextureForShader = function(texture, shader) {
      var gl = this.$gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(shader.uTexture, texture);
   };

   this.createBuffer = function() {
      return this.$gl.createBuffer();
   }

   this.fillBuffer = function(buffer, data) {
      var gl = this.$gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
   }
   
   this.activateBufferForShader = function(buffer, attribLocation, rowsize) {
      var gl = this.$gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(attribLocation, rowsize, gl.FLOAT, false, 0, 0);
   }

   this.uniform1fToShader = function(number, attribLocation) {
      this.$gl.uniform1f(attribLocation, number);
   }

   this.uniform2fToShader = function(number0, number1, attribLocation) {
      this.$gl.uniform2f(attribLocation, number0, number1);
   }

   this.uniform3fToShader = function(number0, number1, number2, attribLocation) {
      this.$gl.uniform3f(attribLocation, number0, number1, number2);
   }

   this.uniform4fToShader = function(number0, number1, number2, number3, attribLocation) {
      this.$gl.uniform4f(attribLocation, number0, number1, number2, number3);
   }

   this.createFont = function() {        
       
       var Font = function(webgl) {
           
            this.updateGrid = function(width, height, characterWidth, lineHeight) {                    
               this.$cols = Math.floor(width  / characterWidth);
               this.$rows = Math.floor(height / lineHeight);
               this.$grid2d = webgl.create2dGridVertices(characterWidth, lineHeight, this.$cols, this.$rows);   
            };
            
            this.draw = function(text, xoffset, yoffset, upsidedown) {        
               webgl.fillBuffer(this.$charBuffer, text);
            
               webgl.$fontShader.bind();
               webgl.uniform1fToShader(12.0, webgl.$fontShader.pointSize);
               webgl.uniform1fToShader(upsidedown ? 1.0 : 0.0, webgl.$fontShader.upsidedown);
               webgl.uniform2fToShader(xoffset !== undefined ? xoffset : 0.0, yoffset !== undefined ? yoffset : 0.0, webgl.$fontShader.offset);
               webgl.activateTextureForShader(this.$fontTexture, webgl.$fontShader);                
               webgl.activateBufferForShader(this.$charBuffer, webgl.$fontShader.index, 1);                
               webgl.drawPoints(this.$grid2d, webgl.$fontShader);
            };

            this.packChar = function(c) {
               return (c - 32) << 18;
            };

            this.packDigit = function(c) {
               return (c + 16) << 18;
            };

            this.packColor = function(r, g, b) {
               r = r >> 2;
               g = g >> 2;
               b = b >> 2;  

               return (r << 12) + (g << 6) + (b);
            };
            
            this.$fontTexture = webgl.createFontTexture(256, 256, 'Monaco', 12, true);
            this.$charBuffer = webgl.createBuffer();            
        };
        
        return new Font(this);                                    
   };

   this.createQuad = function(width, height) {
      var Quad = function(webgl, width, height) {

         this.updateSize = function(width, height) {
            this.$quad = webgl.createQuadVertices(width, height);
         };

         this.draw = function(xoffset, yoffset, r, g, b, a) {
            webgl.$quadShader.bind();
            webgl.uniform2fToShader(xoffset !== undefined ? xoffset : 0.0, yoffset !== undefined ? yoffset : 0.0, webgl.$quadShader.offset);
            webgl.uniform4fToShader(r, g, b, a, webgl.$quadShader.color);
            webgl.drawTriangleStrip(this.$quad, webgl.$quadShader);
         };
      };

      return new Quad(this);
   };

}).call(WebGL.prototype);

exports.WebGL = WebGL;

});
