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
var EventEmitter = require("../lib/event_emitter").EventEmitter;
var WebGL = require("../webgl/webgl").WebGL;

var Text = function(parentEl) {
    //this.element = dom.createElement("div");
    var webgl = this.$webgl = new WebGL();
    this.element = this.$webgl.element;
    this.element.className = "ace_layer ace_text-layer";
    parentEl.appendChild(this.element);
    
    this.$font = webgl.createFont();
    this.$font.updateGrid(this.element.width, this.element.height, this.getCharacterWidth(), this.getLineHeight());

    var div = document.createElement("div");
    div.className = "ace_line";
    this.$hidden = document.createElement("span");    
    div.appendChild(this.$hidden);
    parentEl.appendChild(div);
};

(function() {

    oop.implement(this, EventEmitter);

    this.$padding = 0;

    this.setPadding = function(padding) {
        this.$padding = padding;
        //this.element.style.padding = "0 " + padding + "px";
    };

    this.getLineHeight = function() {
        return 16;
    };

    this.getCharacterWidth = function() {
        return 9;
    };
    
    this.checkForSizeChanges = function() {};

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

    this.$overlayAce = false;
    this.setShowOverlay = function(overlay) {
        this.$overlayAce = overlay;
    };
    
    this.getShowOverlay = function() {
        return this.$overlayAce;
    };

    this.updateLines = function(config, firstRow, lastRow) {
        this.update(config);
    };

    this.scrollLines = function(config) {
        this.update(config);
    };

    this.update = function(config) {
        this.config = config;
//        return;
        if (config.changes | 64) {
            this.$webgl.resize();
            this.$font.updateGrid(this.element.width, this.element.height, this.getCharacterWidth(), this.getLineHeight());
        }

        var firstRow = config.firstRow, lastRow = config.lastRow;

        var row = firstRow;

        //console.log("Update");

        var chars = [];
        for(var i=0;i<this.$font.$cols * this.$font.$rows; i++) 
          chars[i] = 0;
          
        var colors = [];
        for(var i=0;i<this.$font.$cols * this.$font.$rows * 3; i++)
          colors[i] = 0;

        var r = 0, color_index=0;
        while (true) {
            if (row > lastRow)
                break;
           
            var tokens = this.session.getTokens(row, row)[0].tokens;
            var base = r * this.$font.$cols;
            var column = 0;
            for(var i=0; i<tokens.length; i++) {
                var token = tokens[i];
                
                this.$hidden.className = "ace_" + token.type.replace(/\./g, " ace_");                
                var color = dom.computedStyle(this.$hidden, "color").replace("rgb(", "").replace(")", "").split(",");                
                
                for(var c=0; c<token.value.length; c++) {
                    chars[base + column] = token.value.charCodeAt(c) - 32;
                    if(color[0] < 255 || color[1] < 255 || color[2] < 255) {
                        colors[base*3 + column*3+0] = color[0] / 255.0;
                        colors[base*3 + column*3+1] = color[1] / 255.0;
                        colors[base*3 + column*3+2] = color[2] / 255.0;
                    }
                    column++;
                }
            }        

            row++;
            r++;
        }
        this.$font.draw(chars, colors);
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
