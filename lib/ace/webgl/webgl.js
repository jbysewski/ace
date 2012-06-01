/* vim:ts=4:sts=4:sw=4:
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian@ajax.org>
 *      Irakli Gozalishvili <rfobic@gmail.com> (http://jeditoolkit.com)
 *      Julian Viereck <julian.viereck@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var dom = require("../lib/dom");

var WebGL = function(container) {
   this.container = container;

   this.element = dom.createElement("canvas");
   this.element.className = "ace_layer ace_content";
   this.container.appendChild(this.element);
   this.init();

};

(function() {

   this.init = function() {
      var canvas = this.element;
      var gl = this.$gl = canvas.getContext("experimental-webgl",  { alpha: false });

      this.setClearColor(1, 1, 1);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      
      var FontShaderFS = require("ace/requirejs/text!./font_shader.fs");
      var FontShaderVS = require("ace/requirejs/text!./font_shader.vs");

      this.$fontShader = this.createProgram(FontShaderFS, FontShaderVS, 
           {index: "index", vertexPositionAttribute: "aVertexPosition"}, 
           {uResolution: "uResolution", pointSize: "uPointSize", upsidedown: "uUpsidedown", uTexture0: "texture0", uTexture1: "texture1", offset: "uOffset", texSize: "uTextureSize"});

      var PlainShaderFS = require("ace/requirejs/text!./plain_shader.fs");
      var PlainShaderVS = require("ace/requirejs/text!./plain_shader.vs");

      this.$plainShader = this.createProgram(PlainShaderFS, PlainShaderVS, 
           {vertexPositionAttribute: "aVertexPosition"}, 
           {uResolution: "uResolution", color: "uColor", offset: "uOffset"});
      
      var DiscardMinMaxShaderFS = require("ace/requirejs/text!./discard_minmax_shader.fs");

      this.$discardMinMaxShader = this.createProgram(DiscardMinMaxShaderFS, PlainShaderVS, 
           {vertexPositionAttribute: "aVertexPosition"}, 
           {uResolution: "uResolution", color: "uColor", offset: "uOffset", min: "uMin", max: "uMax"});

      var BorderMinMaxShaderFS = require("ace/requirejs/text!./border_minmax_shader.fs");

      this.$borderMinMaxShader = this.createProgram(BorderMinMaxShaderFS, PlainShaderVS, 
           {vertexPositionAttribute: "aVertexPosition"}, 
           {uResolution: "uResolution", color: "uColor", bordercolor: "uBorderColor", offset: "uOffset", min: "uMin", max: "uMax"});
   };

   this.$ready = false;
   this.isReady = function() {
      return this.$ready;
   }

   this.resize = function() {
      this.$ready = false;
      var gl = this.$gl;
      var canvas = this.element;
      
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      gl.viewport(0, 0, canvas.width, canvas.height);  
      this.$ready = true;
   };

   this.setClearColor = function(r, g, b) {
      this.$gl.clearColor(r, g, b, 0.0);
   }

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

   this.createFontTexture = function(width, height, fontname, fontsize, start, end, charsPerRow) {
      return this.$createTextureFromCanvas(this.$createFontCanvas(width, height, fontname, fontsize, start, end, charsPerRow));
   };

   this.$createFontCanvas = function(width, height, fontname, fontsize, start, end, charsPerRow) {
      var imageCanvas = document.createElement( "canvas" );
      var ctx = imageCanvas.getContext( "2d" );
      imageCanvas.width = width;
      imageCanvas.height = height;      
      ctx.font = fontsize + 'px ' + fontname;

      if(start == undefined)
         start = 32;
      if(end == undefined)
         end = 128;
      if(charsPerRow == undefined)
         charsPerRow = 8;
      
      var base = 32;
      ctx.fillStyle = '#000000';
    
      /*
        for(var y=0; y<height; y+=2)
            for(var x = 0;x<width; x+=2)
                 ctx.fillRect(x+0.5,y+0.5,0.5,0.5);
      */

      for(var i = 0;i<end-start; i++){
         var x = i%charsPerRow, y = Math.floor(i/charsPerRow);
         var pX = Math.floor(x/charsPerRow * width)+0.5, pY = Math.floor(y/charsPerRow * height)+0.5;         
         ctx.fillText(String.fromCharCode(i+start),pX,pY+fontsize);  
      }
     
      this.container.appendChild(imageCanvas);

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
            vertices[i++] = x * sizex;
            vertices[i++] = y * sizey;
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

   this.activateTexture0ForShader = function(texture, shader) {
      var gl = this.$gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(shader.uTexture0, 0);
   };

   this.activateTexture1ForShader = function(texture, shader) {
      var gl = this.$gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(shader.uTexture1, 1);
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

   this.$fontTexture0 = {}; // Font texture cache
   this.$fontTexture1 = {}; // each (font, size)-tupel is only created once!
   this.createFont = function(font, fontSize) {        
       
       var Font = function(webgl, font, fontSize) {
           
            this.updateGrid = function(width, height, characterWidth, lineHeight) {                    
               this.$cols = Math.floor(width  / characterWidth);
               this.$rows = Math.floor(height / lineHeight) + 2;
               this.$grid2d = webgl.create2dGridVertices(characterWidth, lineHeight, this.$cols, this.$rows);   
            };
            
            this.draw = function(text, xoffset, yoffset, upsidedown) {        
               webgl.fillBuffer(this.$charBuffer, text);
           
               if(xoffset === undefined)
                  xoffset = 0.0; 
               if(yoffset == undefined)
                  yoffset = 0.0;
               xoffset += 16.0;
               yoffset += 15.0;

               webgl.$fontShader.bind();
               webgl.uniform1fToShader(this.$pointSize, webgl.$fontShader.pointSize);
               webgl.uniform1fToShader(this.$texSize, webgl.$fontShader.texSize);
               webgl.uniform1fToShader(upsidedown ? 1.0 : 0.0, webgl.$fontShader.upsidedown);
               webgl.uniform2fToShader(xoffset , yoffset, webgl.$fontShader.offset);
               webgl.activateTexture0ForShader(webgl.$fontTexture0[this.$fontInfo], webgl.$fontShader);                
               webgl.activateTexture1ForShader(webgl.$fontTexture1[this.$fontInfo], webgl.$fontShader);                
               webgl.activateBufferForShader(this.$charBuffer, webgl.$fontShader.index, 1);                
               webgl.drawPoints(this.$grid2d, webgl.$fontShader);
            };

            this.packChar = function(c) {
               return (c - 32) << 17;
            };

            this.packDigit = function(c) {
               return (c + 16) << 17;
            };

            this.packColor = function(r, g, b) {
               r = r >> 3;
               g = g >> 3;
               b = b >> 3;  

               return (r << 10) + (g << 5) + (b);
            };

            this.$fontSize = fontSize;
            if(fontSize == undefined)
               this.$fontSize = 12;

            this.$font = font;
            if(font == undefined)
                this.$font = 'Monaco';

            this.$texSize = 256;
            this.$pointSize = this.$texSize / 8.0;

            var fontInfo = this.$fontInfo = this.$font + this.$fontSize;

            if(webgl.$fontTexture0[fontInfo] == undefined || webgl.$fontTexture1[fontInfo] == undefined)
            {
                console.log("create font: "+fontInfo);
                webgl.$fontTexture0[fontInfo] = webgl.createFontTexture(this.$texSize, this.$texSize, this.$font, this.$fontSize, 32, 95, 8);
                webgl.$fontTexture1[fontInfo] = webgl.createFontTexture(this.$texSize, this.$texSize, this.$font, this.$fontSize, 96, 128, 8);
            }
            this.$charBuffer = webgl.createBuffer();            
        };
        
        return new Font(this, font, fontSize);                                    
   };

   this.createQuad = function(width, height) {
      var Quad = function(webgl) {

         this.updateSize = function(width, height) {
            this.$quad = webgl.createQuadVertices(width, height);
         };

         this.draw = function(xoffset, yoffset, r, g, b, a) {
            webgl.$plainShader.bind();
            webgl.uniform2fToShader(xoffset, yoffset, webgl.$plainShader.offset);
            webgl.uniform4fToShader(r, g, b, a, webgl.$plainShader.color);
            webgl.drawTriangleStrip(this.$quad, webgl.$plainShader);
         };
      };

      return new Quad(this);
   };

   this.createMinMaxQuad = function(width, height) {
      var Quad = function(webgl) {

         this.updateSize = function(width, height) {
            this.$quad = webgl.createQuadVertices(width, height);
         };

         this.draw = function(xoffset, yoffset, minx, miny, maxx, maxy, color) {
            webgl.$discardMinMaxShader.bind();
            webgl.uniform2fToShader(minx, miny, webgl.$discardMinMaxShader.min);
            webgl.uniform2fToShader(maxx, maxy, webgl.$discardMinMaxShader.max);
            webgl.uniform2fToShader(xoffset, yoffset, webgl.$discardMinMaxShader.offset);
            webgl.uniform4fToShader(color.r, color.g, color.b, color.a, webgl.$discardMinMaxShader.color);
            webgl.drawTriangleStrip(this.$quad, webgl.$discardMinMaxShader);
         };
      };

      return new Quad(this);
   };

   this.createBorderMinMaxQuad = function(width, height) {
      var Quad = function(webgl) {

         this.updateSize = function(width, height) {
            this.$quad = webgl.createQuadVertices(width, height);
         };

         this.draw = function(xoffset, yoffset, minx, miny, maxx, maxy, color, bordercolor) {
            webgl.$borderMinMaxShader.bind();
            webgl.uniform2fToShader(minx, miny, webgl.$borderMinMaxShader.min);
            webgl.uniform2fToShader(maxx, maxy, webgl.$borderMinMaxShader.max);
            webgl.uniform2fToShader(xoffset, yoffset, webgl.$borderMinMaxShader.offset);
            webgl.uniform4fToShader(color.r, color.g, color.b, color.a, webgl.$borderMinMaxShader.color);
            webgl.uniform4fToShader(bordercolor.r, bordercolor.g, bordercolor.b, bordercolor.a, webgl.$borderMinMaxShader.bordercolor);
            webgl.drawTriangleStrip(this.$quad, webgl.$borderMinMaxShader);
         };
      };

      return new Quad(this);
   };

}).call(WebGL.prototype);

exports.WebGL = WebGL;

});
