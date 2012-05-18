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
var EventEmitter = require("../lib/event_emitter").EventEmitter;

var Gutter = function(webgl) {
    this.$webgl = webgl;
    this.setShowFoldWidgets(this.$showFoldWidgets);
    
    this.gutterWidth = 0;

    this.$breakpoints = [];
    this.$annotations = [];
    this.$decorations = [];

    this.$font = webgl.createFont();
    this.$background = webgl.createQuad();
};

(function() {

    oop.implement(this, EventEmitter);
    
    this.setSession = function(session) {
        this.session = session;
    };

    this.addGutterDecoration = function(row, className){
        if (!this.$decorations[row])
            this.$decorations[row] = "";
        this.$decorations[row] += " " + className;
    };

    this.removeGutterDecoration = function(row, className){
        this.$decorations[row] = this.$decorations[row].replace(" " + className, "");
    };

    this.setBreakpoints = function(rows) {
        this.$breakpoints = rows.concat();
    };

    this.setAnnotations = function(annotations) {
        // iterate over sparse array
        this.$annotations = [];
        for (var row in annotations) if (annotations.hasOwnProperty(row)) {
            var rowAnnotations = annotations[row];
            if (!rowAnnotations)
                continue;

            var rowInfo = this.$annotations[row] = {
                text: []
            };
            for (var i=0; i<rowAnnotations.length; i++) {
                var annotation = rowAnnotations[i];
                var annoText = annotation.text.replace(/"/g, "&quot;").replace(/'/g, "&#8217;").replace(/</, "&lt;");
                if (rowInfo.text.indexOf(annoText) === -1)
                    rowInfo.text.push(annoText);
                var type = annotation.type;
                if (type == "error")
                    rowInfo.className = "ace_error";
                else if (type == "warning" && rowInfo.className != "ace_error")
                    rowInfo.className = "ace_warning";
                else if (type == "info" && (!rowInfo.className))
                    rowInfo.className = "ace_info";
            }
        }
    };

    this.update = function(config) {
        this.$config = config;

        var html = [];
        var row = config.firstRow;
        var lastRow = config.lastRow;
        var fold = this.session.getNextFoldLine(row);
        var foldStart = fold ? fold.start.row : Infinity;
        var foldWidgets = this.$showFoldWidgets && this.session.foldWidgets;

        this.$font.updateGrid(28, config.minHeight, 7, 16);
        this.$background.updateSize(46, config.minHeight);

        var indexes = [];
        for(var i=0;i<this.$font.$cols * this.$font.$rows; i++) 
          indexes[i] = 0;
        var displayIndex = 0;

        while (true) {
            if(row > foldStart) {
                row = fold.end.row + 1;
                fold = this.session.getNextFoldLine(row, fold);
                foldStart = fold ?fold.start.row :Infinity;
            }
            if(row > lastRow)
                break;

            var base = displayIndex * this.$font.$cols;
            var c, digitCount = this.$font.$cols;
            for(c=0; c<digitCount; c++) {
                var maxPresentable = Math.pow(10, this.$font.$cols - c - 1);
                var line = row + 1;
                if(line >= maxPresentable || c == digitCount-1)
                    indexes[base + c] = this.$font.packDigit(Math.floor(line / maxPresentable % 10));
            }

            row++;
            displayIndex++;
        }
        this.$background.draw(0, 0, 0.9, 0.9, 0.9, 1.0); 
        this.$font.draw(indexes, 4, -config.yOffset + 1);
    };

    this.$showFoldWidgets = true;
    this.setShowFoldWidgets = function(show) {
        this.$showFoldWidgets = show;
    };
    
    this.getShowFoldWidgets = function() {
        return this.$showFoldWidgets;
    };

}).call(Gutter.prototype);

exports.Gutter = Gutter;

});
