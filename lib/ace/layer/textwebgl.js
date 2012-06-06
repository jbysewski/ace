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

var Text = function(teflon, textViewer) {
    this.$teflon = teflon;
    this.$textViewer = textViewer;
    
    var div = document.createElement("div");
    div.className = "ace_text-layer ace_line";
    this.$hidden = document.createElement("span");    
    div.appendChild(this.$hidden);
    teflon.canvas.appendChild(div);
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
        return 7;
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
        var oldconfig = this.config;
        this.config = config;
        //if(oldconfig.firstRow != config.firstRow)
            //this.update(config);
    };

    this.update = function(config) {

        this.config = config;
        
        this.$textViewer.text.clear();

        for(var row=0; row<this.session.getLength(); row++) {
            var tokens = this.session.getTokens(row, row)[0].tokens;
            var column = 0;
            for(var i=0; i<tokens.length; i++) {
                var token = tokens[i];
                var color = this.$extractColor(token);
                var colorId = this.$textViewer.palette.colors[color];
                if(colorId === undefined)
                    console.log(color);
                this.$textViewer.text.addColorSubLine(token.value, colorId, column);
                column += token.value.length;
            }        

            this.$textViewer.text.newLine();
        }
    };

    this.draw = function() {
        //console.log("draw text");
        this.$textViewer.text.pan = (-this.config.xOffset) / 7;
        this.$textViewer.text.scroll = this.config.yOffset / 16 + this.config.firstRow;
        this.$textViewer.repaint();
    }
   
    this.$colorCache = {}; 
    this.$extractColor = function(token) {
        if(token.type in this.$colorCache) {
            return this.$colorCache[token.type];
        }

        this.$hidden.className = "ace_" + token.type.replace(/\./g, " ace_");                
        return this.$colorCache[token.type] = dom.computedStyle(this.$hidden, "color");                
    };

    this.destroy = function() {
        clearInterval(this.$pollSizeChangesTimer);
    };

    this.invalidateStyleCache = function() {
        this.$colorCache = {};
    } 

}).call(Text.prototype);

exports.Text = Text;

});
