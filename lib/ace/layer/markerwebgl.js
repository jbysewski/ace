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

var Range = require("../range").Range;
var dom = require("../lib/dom");

var Marker = function(webgl) {
    this.$webgl = webgl;


    this.$multilineQuad = webgl.createMinMaxQuad();
    this.$singlelineQuad = webgl.createBorderMinMaxQuad();

    var div = document.createElement("div");
    div.className = "ace_layer ace_marker-layer";
    this.$hidden = document.createElement("span");    
    div.appendChild(this.$hidden);
    webgl.element.appendChild(div);
};

(function() {

    this.$padding = 0;

    this.setPadding = function(padding) {
        this.$padding = padding;
    };
    this.setSession = function(session) {
        this.session = session;
    };
    
    this.setMarkers = function(markers) {
        this.markers = markers;
    };

    this.update = function(config) {
        var config = config || this.config;
        if (!config)
            return;

        this.config = config;


        var html = [];
        for ( var key in this.markers) {
            var marker = this.markers[key];

            var range = marker.range.clipRows(config.firstRow, config.lastRow);
            if (range.isEmpty()) continue;

            range = range.toScreenRange(this.session);
            if (marker.renderer) {
                var top = this.$getTop(range.start.row, config);
                var left = Math.round(
                    this.$padding + range.start.column * config.characterWidth
                );
                console.log("Marker with own renderer: not supported yet!");
            }
            else if (range.isMultiLine()) {
                if (marker.type == "text") {
                    this.drawTextMarker(html, range, marker.clazz, config);
                } else {
                    this.drawMultiLineMarker(
                        html, range, marker.clazz, config,
                        marker.type
                    );
                }
            }
            else {
                this.drawSingleLineMarker(
                    html, range, marker.clazz + " start", config,
                    null, marker.type
                );                
            }
        }
    };

    this.$getTop = function(row, layerConfig) {
        return (row - layerConfig.firstRowScreen) * layerConfig.lineHeight - layerConfig.yOffset;
    };

    // Draws a marker, which spans a range of text on multiple lines 
    this.drawTextMarker = function(stringBuilder, range, clazz, layerConfig) {
        // selection start
        var row = range.start.row;

        var lineRange = new Range(
            row, range.start.column,
            row, this.session.getScreenLastRowColumn(row)
        );
        this.drawSingleLineMarker(stringBuilder, lineRange, clazz + " start", layerConfig, 1, "text");

        // selection end
        row = range.end.row;
        lineRange = new Range(row, 0, row, range.end.column);
        this.drawSingleLineMarker(stringBuilder, lineRange, clazz, layerConfig, 0, "text");

        for (row = range.start.row + 1; row < range.end.row; row++) {
            lineRange.start.row = row;
            lineRange.end.row = row;
            lineRange.end.column = this.session.getScreenLastRowColumn(row);
            this.drawSingleLineMarker(stringBuilder, lineRange, clazz, layerConfig, 1, "text");
        }
    };

     // Draws a multi line marker, where lines span the full width
     this.drawMultiLineMarker = function(stringBuilder, range, clazz, layerConfig, type) {
        var background = type === "background";
        var halfCharWidth = 0.5 * layerConfig.characterWidth;
        var padding = background ? 0 : layerConfig.xOffset - 2 + halfCharWidth;
        var layerWidth = layerConfig.width - padding - 2;        
        // from selection start to the end of the line
        var height = layerConfig.lineHeight;
        var width = Math.round(layerWidth - (range.start.column * layerConfig.characterWidth));
        var top = this.$getTop(range.start.row, layerConfig);
        var left = padding + range.start.column * layerConfig.characterWidth;

        var lastSelectionLineWidth = Math.round(range.end.column * layerConfig.characterWidth);
        var right = lastSelectionLineWidth + padding;

        var color = this.$extractStyle(clazz).background;

        height = (range.end.row - range.start.row + 1) * layerConfig.lineHeight;
        this.$multilineQuad.updateSize(layerWidth, height);
        this.$multilineQuad.draw(padding, top, left, top + layerConfig.lineHeight, right, top + height - layerConfig.lineHeight, color);
    };

    // Draws a marker which covers part or whole width of a single screen line
    this.drawSingleLineMarker = function(stringBuilder, range, clazz, layerConfig, extraLength, type) {
        var background = type === "background";
        var halfCharWidth = 0.5 * layerConfig.characterWidth;
        var padding = background ? 0 : layerConfig.xOffset - 2 + halfCharWidth;
        var height = layerConfig.lineHeight;

        if (type === "background")
            var width = layerConfig.width;
        else
            width = Math.round((range.end.column + (extraLength || 0) - range.start.column) * layerConfig.characterWidth);

        var top = this.$getTop(range.start.row, layerConfig);
        var left = Math.round(
            padding + range.start.column * layerConfig.characterWidth
        );

        var style = this.$extractStyle(clazz);
        var border = style.border.width; 

        this.$singlelineQuad.updateSize(width, height);
        this.$singlelineQuad.draw(left, top, left + border, top + border, left + width - border, top + height - border, style.background, style.border);
    };


    this.$styleCache = {}; 
    this.$extractStyle = function(clazz) {
        if(clazz in this.$styleCache) {
            return this.$styleCache[clazz];
        }

        this.$hidden.className = clazz;
        var color = dom.computedStyle(this.$hidden, "background").replace(/.*rgb\(/, "").replace("rgba(", "").replace(/\).*/, "").split(",");                
        var borderstyle =  dom.computedStyle(this.$hidden, "border");
        var bordercolor = borderstyle.replace(/.*rgb\(/, "").replace("rgba(", "").replace(/\).*/, "").split(",");                
        var borderwidth = parseInt(borderstyle.replace(/px.*/, ""));

        var style = {
            "background": { "r": color[0]/255, "g": color[1]/255, "b": color[2]/255, "a": color[3] === undefined ? 1 : color[3] },
            "border": { "r": bordercolor[0]/255, "g": bordercolor[1]/255, "b": bordercolor[2]/255, "a": bordercolor[3] === undefined ? 1 : bordercolor[3], "width": borderwidth }
        };

        this.$styleCache[clazz] = style;
        return style;
    };

    this.invalidateStyleCache = function() {
        this.$styleCache = {};
    }

}).call(Marker.prototype);

exports.Marker = Marker;

});