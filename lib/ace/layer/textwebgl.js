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
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *      Julian Viereck <julian DOT viereck AT gmail DOT com>
 *      Mihai Sucan <mihai.sucan@gmail.com>
 *      Irakli Gozalishvili <rfobic@gmail.com> (http://jeditoolkit.com)
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

var oop = require("../lib/oop");
var dom = require("../lib/dom");
var lang = require("../lib/lang");
var useragent = require("../lib/useragent");
var EventEmitter = require("../lib/event_emitter").EventEmitter;
var WebGL = require("../webgl/webgl").WebGL;

var Text = function(parentEl) {
    //this.element = dom.createElement("div");
    var webgl = this.$webgl = new WebGL();
    this.element = this.$webgl.element;
    this.element.className = "ace_layer ace_text-layer";
    parentEl.appendChild(this.element);

    this.checkForSizeChanges();
    this.$fontTexture = webgl.createFontTexture(256, 256, 'Monaco', 20);
    this.$charBuffer = webgl.createBuffer();
    
    var fs = 
        "precision mediump float;" +
        ""+
        "uniform sampler2D texture;"+
        "varying vec2 voffset;"+
        ""+
        "void main(void) {"+
        //"    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);"+
        "    vec2 pos = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);"+
        //"    gl_FragColor = vec4(voffset.x, 0.5, 0.0, 1.0);"+
        "    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * texture2D(texture, pos / 10.0 + voffset);"+        
        "}";
    var vs = 
        "attribute float index;"+
        "attribute vec2 aVertexPosition;"+
        ""+
        "uniform vec2 uResolution;"+
        ""+
        "varying vec2 voffset;"+
        ""+
        "void main(void) {"+
        "    vec2 pos = aVertexPosition / uResolution * 2.0 - 1.0;"+
        "    gl_Position = vec4(pos * vec2(1,-1), 0, 1);"+
        "    gl_PointSize = 18.0;"+ 
        //"    float index = 43.0;"+
        "    voffset = vec2(mod(index,10.0) * 0.1, floor(index/10.0) * 0.1);"+
        //"    voffset = vec2(0.5, 0.5);"+
        "}";
    this.$fontShader = webgl.createProgram(fs, vs, 
         {index: "index", vertexPositionAttribute: "aVertexPosition"}, 
         {uResolution: "uResolution", uTexture: "texture"});
};

(function() {

    oop.implement(this, EventEmitter);

    this.$padding = 0;

    this.setPadding = function(padding) {
        this.$padding = padding;
        this.element.style.padding = "0 " + padding + "px";
    };

    this.getLineHeight = function() {
        return 16;
    };

    this.getCharacterWidth = function() {
        return 9;
    };

    this.checkForSizeChanges = function() {
        this.$webgl.resize();
        this.$cols = Math.floor(this.element.width  / this.getCharacterWidth());
        this.$rows = Math.floor(this.element.height / this.getLineHeight());
        this.$grid2d = this.$webgl.create2dGrid(this.getCharacterWidth(), this.getLineHeight(), this.$cols, this.$rows);
    };

    this.$pollSizeChanges = function() {
        var self = this;
        this.$pollSizeChangesTimer = setInterval(function() {
            self.checkForSizeChanges();
        }, 500);
    };

    this.$fontStyles = {
        fontFamily : 1,
        fontSize : 1,
        fontWeight : 1,
        fontStyle : 1,
        lineHeight : 1
    };

    this.setSession = function(session) {
        this.session = session;
    };

    this.showInvisibles = false;
    this.setShowInvisibles = function(showInvisibles) {
        if (this.showInvisibles == showInvisibles)
            return false;

        this.showInvisibles = showInvisibles;
        return true;
    };

    this.updateLines = function(config, firstRow, lastRow) {
        this.update(config);
        /*
        this.config = config;

        var first = Math.max(firstRow, config.firstRow);
        var last = Math.min(lastRow, config.lastRow);

        for (var i=first; i<=last; i++) {
            var tokens = this.session.getTokens(i, i);
            //this.$renderLine(html, i, tokens[0].tokens, !this.$useLineGroups());
            //lineElement = dom.setInnerHtml(lineElement, html.join(""));

            i = this.session.getRowFoldEnd(i);
        }
        */
    };

    this.scrollLines = function(config) {

    };

    this.update = function(config) {
        this.config = config;

        var firstRow = config.firstRow, lastRow = config.lastRow;

        var row = firstRow;

        console.log("Update");

        var webgl = this.$webgl;
        var chars = [];
        for(var i=0;i<this.$cols * this.$rows; i++) 
          chars[i] = 0;

        var r = 0;
        while (true) {
            if (row > lastRow)
                break;
           
            var tokens = this.session.getTokens(row, row)[0].tokens;
            //if (tokens.length == 1)
            //    this.$renderLine(html, row, tokens[0].tokens, false);
            var base = r * this.$cols;
            var column = 0;
            for(var i=0; i<tokens.length; i++) {
                var token = tokens[i];
                for(var c=0; c<token.value.length; c++) {
                    chars[base + column++] = token.value.charCodeAt(c) - 32;
                }
            }        
            //for(column; column<this.$cols; column++) {
            //    chars[base + column] = 0;
            //}

            row++;
            r++;
        }
        webgl.fillBuffer(this.$charBuffer, chars);

        webgl.clear();
        webgl.activateTextureForShader(this.$fontTexture, this.$fontShader);
        webgl.activateBufferForShader(this.$charBuffer, this.$fontShader.index, 1);
        webgl.drawPoints(this.$grid2d, this.$fontShader);
    };

    this.$textToken = {
        "text": true,
        "rparen": true,
        "lparen": true
    };

    this.destroy = function() {
        clearInterval(this.$pollSizeChangesTimer);
    };

}).call(Text.prototype);

exports.Text = Text;

});
