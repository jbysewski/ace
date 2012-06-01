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

var oop = require("../lib/oop");
var EventEmitter = require("../lib/event_emitter").EventEmitter;

var Cursor = function(webgl) {
    this.$webgl = webgl;

    this.isVisible = false;
    this.blink = false;

    this.cursors = [];
    this.cursor = this.addCursor();
};

(function() {
    oop.implement(this, EventEmitter);

    this.$padding = 0;
    this.setPadding = function(padding) {
        this.$padding = padding;
    };

    this.setSession = function(session) {
        this.session = session;
    };

    this.addCursor = function() {
        var quad = this.$webgl.createQuad();
        quad.updateSize(64, 64);
        this.cursors.push(quad);
        return quad;
    };

    this.hideCursor = function() {
        this.isVisible = false;
        clearInterval(this.blinkId);
        this._emit("requestUpdate");
    };

    this.showCursor = function() {
        this.isVisible = true;
        this.restartTimer();
        this._emit("requestUpdate");
    };

    this.restartTimer = function() {
        clearInterval(this.blinkId);
        if (!this.isVisible)
            return;

        var _self = this;
        this.blinkId = setInterval(function() {
            _self.blink = true;
            _self._emit("requestUpdate");
            setTimeout(function() {
                _self.blink = false;
                _self._emit("requestUpdate");
            }, 400);
        }, 1000);
    };

    this.getPixelPosition = function(position, onScreen) {
        if (!this.config || !this.session) {
            return {
                left : 0,
                top : 0
            };
        }

        if (!position)
            position = this.session.selection.getCursor();
        var pos = this.session.documentToScreenPosition(position);
        var cursorLeft = Math.round(this.$padding +
                                    pos.column * this.config.characterWidth) + 1;
        var cursorTop = (pos.row - (onScreen ? this.config.firstRowScreen : 0)) *
            this.config.lineHeight;

        return {
            left : cursorLeft,
            top : cursorTop
        };
    };

    this.update = function(config) {
        this.config = config;
    };

    this.draw = function() {

        if(!this.isVisible || this.blink)
            return;

        if (this.session.selectionMarkerCount > 0) {
            var selections = this.session.$selectionMarkers;
            var i = 0, sel, cursorIndex = 0;

            for (var i = selections.length; i--; ) {
                sel = selections[i];
                var pixelPos = this.getPixelPosition(sel.cursor, true);

                var cursor = (this.cursors[cursorIndex++] || this.addCursor());
                this.$drawCursor(cursor, pixelPos);
            }
        } else {

            while (this.cursors.length > 1)
                this.removeCursor();
                
            var cursor = this.cursors[0];
            var pixelPos = this.getPixelPosition(null, true);
            this.$drawCursor(cursor, pixelPos);
        }

        var overwrite = this.session.getOverwrite();
        if (overwrite != this.overwrite)
            this.$setOverite(overwrite);
    };

    this.$drawCursor = function(cursor, pos) {
        if(cursor.width !== this.config.characterWidth || cursor.height !== this.config.lineHeight)
                cursor.updateSize(2, this.config.lineHeight);

        cursor.draw(pos.left + this.config.xOffset, pos.top - this.config.yOffset, 0.0, 0.0, 0.0, 0.8);
    }

    this.$setOverite = function(overwrite) {
        this.overwrite = overwrite;
    };

    this.destroy = function() {
        clearInterval(this.blinkId);
    }

}).call(Cursor.prototype);

exports.Cursor = Cursor;

});
