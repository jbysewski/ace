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

var oop = require("./lib/oop");
var dom = require("./lib/dom");
var event = require("./lib/event");
var useragent = require("./lib/useragent");
var config = require("./config");
var net = require("./lib/net");
var GutterLayer = require("./layer/gutter").Gutter;
var WebGLGutterLayer = require("./layer/gutterwebgl").Gutter;
var MarkerLayer = require("./layer/marker").Marker;
var MarkerLayerWebGL = require("./layer/markerwebgl").Marker;
var WebGLTextLayer = require("./layer/textwebgl").Text;
var CursorWebGLLayer = require("./layer/cursorwebgl").Cursor;
var CursorLayer = require("./layer/cursor").Cursor;
var ScrollBar = require("./scrollbar").ScrollBar;
var RenderLoop = require("./renderloop").RenderLoop;
var EventEmitter = require("./lib/event_emitter").EventEmitter;
var editorCss = require("ace/requirejs/text!./css/editor.css");
var WebGL = require("./webgl/webgl").WebGL;
var Teflon = require("./teflon/teflon_ace").Teflon;

dom.importCssString(editorCss, "ace_editor");


(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = 
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

/**
 * class VirtualRenderer
 *
 * The class that is responsible for drawing everything you see on the screen!
 *
 **/

/**
 * new VirtualRenderer(container, theme)
 * - container (DOMElement): The root element of the editor 
 * - theme (String): The starting theme
 *
 * Constructs a new `VirtualRenderer` within the `container` specified, applying the given `theme`.
 *
 **/

var VirtualRenderer = function(container, theme, do60fps) {
    var _self = this;

    this.container = container;
    dom.addCssClass(container, "ace_editor");
    
    var teflon = this.$teflon = new Teflon(container, {cssClassName : "ace_layer ace_content"});
    //teflon.refitViewport();

    this.$palette = this.createDefaultPalette();
    this.$font = teflon.createFont();
    this.$textViewer = teflon.createTextViewer([this.$font], this.$palette);
    this.$textViewer.updateOptions({bgColor : "#ffffff"});

    //var webgl = this.$webgl = new WebGL(this.container);

    var hidden = this.$hidden = document.createElement("div");    
    this.$hidden.className = "ace_scroller";
    teflon.canvas.appendChild(this.$hidden);


    this.setTheme(theme);
    
    var textLayer = this.$textLayer = new WebGLTextLayer(this.$teflon, this.$textViewer);
        
    this.$gutter = dom.createElement("div");
    this.$gutter.className = "ace_gutter";
    //this.container.appendChild(this.$gutter);

    this.scroller = dom.createElement("div");
    this.scroller.className = "ace_scroller";
    //this.container.appendChild(this.scroller);

    this.content = dom.createElement("div");
    this.content.className = "ace_content";
    //this.scroller.appendChild(this.content);

    this.setHighlightGutterLine(false);
    this.$gutterLayer = new GutterLayer(hidden);//WebGLGutterLayer(webgl);
    this.$gutterLayer.on("changeGutterWidth", this.onResize.bind(this, true));
    this.setFadeFoldWidgets(false);

    this.$markerBack = new MarkerLayer(hidden);//MarkerLayerWebGL(webgl);

    this.$markerFront = new MarkerLayer(hidden);//MarkerLayerWebGL(webgl);

    this.characterWidth = textLayer.getCharacterWidth();
    this.lineHeight = textLayer.getLineHeight();

    this.$cursorLayer = new CursorLayer(container);//CursorWebGLLayer(webgl);
    event.addListener(this.$cursorLayer, "requestUpdate", function() {
        _self.$loop.schedule(_self.CHANGE_CURSOR);
    });

    // Indicates whether the horizontal scrollbar is visible
    this.$horizScroll = false;
    this.$horizScrollAlwaysVisible = false;

    this.$animatedScroll = false;

    this.scrollBar = new ScrollBar(container);
    this.scrollBar.addEventListener("scroll", function(e) {
        if (!_self.$inScrollAnimation)
            _self.session.setScrollTop(e.data);
    });

    this.scrollTop = 0;
    this.scrollLeft = 0;

    /*
    event.addListener(this.scroller, "scroll", function() {
        var scrollLeft = _self.scroller.scrollLeft;
        _self.scrollLeft = scrollLeft;
        _self.session.setScrollLeft(scrollLeft);

        _self.scroller.className = scrollLeft == 0
            ? "ace_scroller"
            : "ace_scroller horscroll";
    });
    */

    this.cursorPos = {
        row : 0,
        column : 0
    };

    /*
    this.$textLayer.addEventListener("changeCharacterSize", function() {
        _self.characterWidth = textLayer.getCharacterWidth();
        _self.lineHeight = textLayer.getLineHeight();
        _self.$updatePrintMargin();
        _self.onResize(true);

        _self.$loop.schedule(_self.CHANGE_FULL);
    });
    */

    this.$size = {
        width: 0,
        height: 0,
        scrollerHeight: 0,
        scrollerWidth: 0
    };

    this.layerConfig = {
        width : 1,
        padding : 0,
        firstRow : 0,
        firstRowScreen: 0,
        lastRow : 0,
        lineHeight : 1,
        characterWidth : 1,
        minHeight : 1,
        maxHeight : 1,
        height : 1,
        xOffset : 0,
        yOffset : 0,
        upsidedown : false
    };

    this.$loop = new RenderLoop(
        this.$renderChanges.bind(this),
        this.container.ownerDocument.defaultView
    );
    this.$loop.schedule(this.CHANGE_FULL);

    this.setPadding(0);
    this.$updatePrintMargin();

    this.$upsidedown = false;
    this.$60fps = false;
};

(function() {
    this.showGutter = true;

    this.CHANGE_CURSOR = 1;
    this.CHANGE_MARKER = 2;
    this.CHANGE_GUTTER = 4;
    this.CHANGE_SCROLL = 8;
    this.CHANGE_LINES = 16;
    this.CHANGE_TEXT = 32;
    this.CHANGE_SIZE = 64;
    this.CHANGE_MARKER_BACK = 128;
    this.CHANGE_MARKER_FRONT = 256;
    this.CHANGE_FULL = 512;
    this.CHANGE_H_SCROLL = 1024;

    oop.implement(this, EventEmitter);

    this.set60fps = function(do60fps) {
        var _self = this;
        this.$60fps = do60fps;
        if(do60fps)
            (function animloop(){
              _self.animationFrameId = requestAnimationFrame(animloop);
              //if(_self.$webgl.isReady()) _self.$draw();
            })();
        else if(this.animationFrameId !== undefined)
            cancelAnimationFrame(this.animationFrameId);
    }

    /**
    * VirtualRenderer.setSession(session) -> Void
    * 
    * Associates an [[EditSession `EditSession`]].
    **/
    this.setSession = function(session) {
        this.session = session;
        
        this.scroller.className = "ace_scroller";
        
        this.$cursorLayer.setSession(session);
        this.$markerBack.setSession(session);
        this.$markerFront.setSession(session);
        this.$gutterLayer.setSession(session);
        this.$textLayer.setSession(session);
        this.$loop.schedule(this.CHANGE_FULL);
        
    };

    /**
    * VirtualRenderer.updateLines(firstRow, lastRow) -> Void
    * - firstRow (Number): The first row to update
    * - lastRow (Number): The last row to update
    *
    * Triggers a partial update of the text, from the range given by the two parameters.
    **/
    this.updateLines = function(firstRow, lastRow) {
        if (lastRow === undefined)
            lastRow = Infinity;

        if (!this.$changedLines) {
            this.$changedLines = {
                firstRow: firstRow,
                lastRow: lastRow
            };
        }
        else {
            if (this.$changedLines.firstRow > firstRow)
                this.$changedLines.firstRow = firstRow;

            if (this.$changedLines.lastRow < lastRow)
                this.$changedLines.lastRow = lastRow;
        }

        this.$loop.schedule(this.CHANGE_LINES);
    };

    /**
    * VirtualRenderer.updateText() -> Void
    *
    * Triggers a full update of the text, for all the rows.
    **/
    this.updateText = function() {
        this.$loop.schedule(this.CHANGE_TEXT);
    };

    /**
    * VirtualRenderer.updateFull() -> Void
    *
    * Triggers a full update of all the layers, for all the rows.
    **/
    this.updateFull = function() {
        this.$loop.schedule(this.CHANGE_FULL);
    };

    /**
    * VirtualRenderer.updateFontSize() -> Void
    *
    * Updates the font size.
    **/
    this.updateFontSize = function() {
        this.$textLayer.checkForSizeChanges();
    };

    /**
    * VirtualRenderer.onResize(force) -> Void
    * - force (Boolean): If `true`, recomputes the size, even if the height and width haven't changed
    *
    * [Triggers a resize of the editor.]{: #VirtualRenderer.onResize}
    **/
    this.onResize = function(force) {
        var changes = this.CHANGE_SIZE;
        var size = this.$size;

        var height = dom.getInnerHeight(this.container);
        if (force || size.height != height) {
            size.height = height;

            this.scroller.style.height = height + "px";
            //size.scrollerHeight = this.scroller.clientHeight;
            size.scrollerHeight = height;
            this.scrollBar.setHeight(size.scrollerHeight);

            if (this.session) {
                this.session.setScrollTop(this.getScrollTop());
                changes = changes | this.CHANGE_FULL;
            }
        }

        var width = dom.getInnerWidth(this.container);
        if (force || size.width != width) {
            size.width = width;

            var gutterWidth = this.showGutter ? this.$gutter.offsetWidth : 0;
            this.scroller.style.left = gutterWidth + "px";
            size.scrollerWidth = Math.max(0, width - gutterWidth - this.scrollBar.getWidth());
            this.scroller.style.width = size.scrollerWidth + "px";

            if (this.session.getUseWrapMode() && this.adjustWrapLimit() || force)
                changes = changes | this.CHANGE_FULL;
        }

        this.$teflon.refitViewport();
        this.$loop.schedule(changes);
    };

    /**
    * VirtualRenderer.adjustWrapLimit() -> Void
    *
    * Adjusts the wrap limit, which is the number of characters that can fit within the width of the edit area on screen.
    **/
    this.adjustWrapLimit = function() {
        var availableWidth = this.$size.scrollerWidth - this.$padding * 2;
        var limit = Math.floor(availableWidth / this.characterWidth);
        return this.session.adjustWrapLimit(limit);
    };

    /**
    * VirtualRenderer.setAnimatedScroll(shouldAnimate) -> Void
    * - shouldAnimate (Boolean): Set to `true` to show animated scrolls
    *
    * Identifies whether you want to have an animated scroll or not.
    *
    **/
    this.setAnimatedScroll = function(shouldAnimate){
        this.$animatedScroll = shouldAnimate;
    };

    /**
    * VirtualRenderer.getAnimatedScroll() -> Boolean
    *
    * Returns whether an animated scroll happens or not.
    **/
    this.getAnimatedScroll = function() {
        return this.$animatedScroll;
    };

    /**
    * VirtualRenderer.setShowInvisibles(showInvisibles) -> Void
    * - showInvisibles (Boolean): Set to `true` to show invisibles
    *
    * Identifies whether you want to show invisible characters or not.
    *
    **/
    this.setShowInvisibles = function(showInvisibles) {
        if (this.$textLayer.setShowInvisibles(showInvisibles))
            this.$loop.schedule(this.CHANGE_TEXT);
    };

    /**
    * VirtualRenderer.getShowInvisibles() -> Boolean
    *
    * Returns whether invisible characters are being shown or not.
    **/
    this.getShowInvisibles = function() {
        return this.$textLayer.showInvisibles;
    };

    this.$showPrintMargin = true;

    /**
    * VirtualRenderer.setShowPrintMargin(showPrintMargin)
    * - showPrintMargin (Boolean): Set to `true` to show the print margin
    *
    * Identifies whether you want to show the print margin or not.
    *
    **/
    this.setShowPrintMargin = function(showPrintMargin) {
        this.$showPrintMargin = showPrintMargin;
        this.$updatePrintMargin();
    };

    /**
    * VirtualRenderer.getShowPrintMargin() -> Boolean
    *
    * Returns whetherthe print margin is being shown or not.
    **/
    this.getShowPrintMargin = function() {
        return this.$showPrintMargin;
    };

    this.$printMarginColumn = 80;

    /**
    * VirtualRenderer.setPrintMarginColumn(showPrintMargin)
    * - showPrintMargin (Boolean): Set to `true` to show the print margin column
    *
    * Identifies whether you want to show the print margin column or not.
    *
    **/
    this.setPrintMarginColumn = function(showPrintMargin) {
        this.$printMarginColumn = showPrintMargin;
        this.$updatePrintMargin();
    };

    /**
    * VirtualRenderer.getPrintMarginColumn() -> Boolean
    *
    * Returns whether the print margin column is being shown or not.
    **/
    this.getPrintMarginColumn = function() {
        return this.$printMarginColumn;
    };

    /**
    * VirtualRenderer.getShowGutter() -> Boolean
    *
    * Returns `true` if the gutter is being shown.
    **/
    this.getShowGutter = function(){
        return this.showGutter;
    };

    /**
    * VirtualRenderer.setShowGutter(show) -> Void
    * - show (Boolean): Set to `true` to show the gutter
    *
    * Identifies whether you want to show the gutter or not.
    **/
    this.setShowGutter = function(show){
        if(this.showGutter === show)
            return;
        this.$gutter.style.display = show ? "block" : "none";
        this.showGutter = show;
        this.onResize(true);
    };

    this.getFadeFoldWidgets = function(){
        return dom.hasCssClass(this.$gutter, "ace_fade-fold-widgets");
    };

    this.setFadeFoldWidgets = function(show) {
        if (show)
            dom.addCssClass(this.$gutter, "ace_fade-fold-widgets");
        else
            dom.removeCssClass(this.$gutter, "ace_fade-fold-widgets");
    };

    this.$highlightGutterLine = false;
    this.setHighlightGutterLine = function(shouldHighlight) {
        if (this.$highlightGutterLine == shouldHighlight)
            return;
        this.$highlightGutterLine = shouldHighlight;
        
        
        if (!this.$gutterLineHighlight) {
            this.$gutterLineHighlight = dom.createElement("div");
            this.$gutterLineHighlight.className = "ace_gutter_active_line";
            this.$gutter.appendChild(this.$gutterLineHighlight);
            return;
        }

        this.$gutterLineHighlight.style.display = shouldHighlight ? "" : "none";
        this.$updateGutterLineHighlight();
    };

    this.getHighlightGutterLine = function() {
        return this.$highlightGutterLine;
    };

    this.$updateGutterLineHighlight = function() {
        this.$gutterLineHighlight.style.top = this.$cursorLayer.$pixelPos.top + "px";
        this.$gutterLineHighlight.style.height = this.layerConfig.lineHeight + "px";
    };
    
    this.$updatePrintMargin = function() {
        var containerEl;

        if (!this.$showPrintMargin && !this.$printMarginEl)
            return;

        if (!this.$printMarginEl) {
            containerEl = dom.createElement("div");
            containerEl.className = "ace_print_margin_layer";
            this.$printMarginEl = dom.createElement("div");
            this.$printMarginEl.className = "ace_print_margin";
            containerEl.appendChild(this.$printMarginEl);
            //this.content.insertBefore(containerEl, this.$textLayer.element);
        }

        var style = this.$printMarginEl.style;
        style.left = ((this.characterWidth * this.$printMarginColumn) + this.$padding) + "px";
        style.visibility = this.$showPrintMargin ? "visible" : "hidden";
    };

    /**
    * VirtualRenderer.getContainerElement() -> DOMElement
    *
    * Returns the root element containing this renderer.
    **/
    this.getContainerElement = function() {
        return this.container;
    };

    /**
    * VirtualRenderer.getMouseEventTarget() -> DOMElement
    *
    * Returns the element that the mouse events are attached to
    **/
    this.getMouseEventTarget = function() {
        //return this.content;
        return this.container;
    };

    /**
    * VirtualRenderer.getTextAreaContainer() -> DOMElement
    *
    * Returns the element to which the hidden text area is added.
    **/
    this.getTextAreaContainer = function() {
        return this.container;
    };

    // move text input over the cursor
    // this is required for iOS and IME
    this.$moveTextAreaToCursor = function() {
        if (!this.$keepTextAreaAtCursor)
            return;

        var posTop = this.$cursorLayer.$pixelPos.top;
        var posLeft = this.$cursorLayer.$pixelPos.left;
        posTop -= this.layerConfig.offset;

        if (posTop < 0 || posTop > this.layerConfig.height)
            return;

        posLeft += (this.showGutter ? this.$gutterLayer.gutterWidth : 0) - this.scrollLeft;
        var bounds = this.container.getBoundingClientRect();
        this.textarea.style.left = (bounds.left + posLeft) + "px";
        this.textarea.style.top = (bounds.top + posTop) + "px";
    };

    /**
    * VirtualRenderer.getFirstVisibleRow() -> Number
    *
    * [Returns the index of the first visible row.]{: #VirtualRenderer.getFirstVisibleRow}
    **/
    this.getFirstVisibleRow = function() {
        return this.layerConfig.firstRow;
    };

    /**
    * VirtualRenderer.getFirstFullyVisibleRow() -> Number
    *
    * Returns the index of the first fully visible row. "Fully" here means that the characters in the row are not truncated; that the top and the bottom of the row are on the screen.
    **/
    this.getFirstFullyVisibleRow = function() {
        return this.layerConfig.firstRow + (this.layerConfig.offset === 0 ? 0 : 1);
    };

    /**
    * VirtualRenderer.getLastFullyVisibleRow() -> Number
    *
    * Returns the index of the last fully visible row. "Fully" here means that the characters in the row are not truncated; that the top and the bottom of the row are on the screen.
    **/
    this.getLastFullyVisibleRow = function() {
        var flint = Math.floor((this.layerConfig.height + this.layerConfig.offset) / this.layerConfig.lineHeight);
        return this.layerConfig.firstRow - 1 + flint;
    };

    /**
    * VirtualRenderer.getLastVisibleRow() -> Number
    *
    * [Returns the index of the last visible row.]{: #VirtualRenderer.getLastVisibleRow}
    **/
    this.getLastVisibleRow = function() {
        return this.layerConfig.lastRow;
    };

    this.$padding = null;

    /**
    * VirtualRenderer.setPadding(padding) -> Void
    * - padding (Number): A new padding value (in pixels)
    * 
    * Sets the padding for all the layers.
    *
    **/
    this.setPadding = function(padding) {
        this.$padding = padding;
        //this.$textLayer.setPadding(padding);
        this.$cursorLayer.setPadding(padding);
        this.$markerFront.setPadding(padding);
        this.$markerBack.setPadding(padding);
        //this.$loop.schedule(this.CHANGE_FULL);
        //this.$updatePrintMargin();
    };

    this.$upsidedown = null;
    this.getUpsidedown = function() {
        return this.$upsidedown;
    };

    this.setUpsidedown = function(upsidedown) {
        this.$upsidedown = upsidedown;
        this.updateFull();
    };

    /**
    * VirtualRenderer.getHScrollBarAlwaysVisible() -> Boolean
    *
    * Returns whether the horizontal scrollbar is set to be always visible.
    **/
    this.getHScrollBarAlwaysVisible = function() {
        return this.$horizScrollAlwaysVisible;
    };

    /**
    * VirtualRenderer.setHScrollBarAlwaysVisible(alwaysVisible) -> Void
    * - alwaysVisible (Boolean): Set to `true` to make the horizontal scroll bar visible
    *
    * Identifies whether you want to show the horizontal scrollbar or not. 
    **/
    this.setHScrollBarAlwaysVisible = function(alwaysVisible) {
        if (this.$horizScrollAlwaysVisible != alwaysVisible) {
            this.$horizScrollAlwaysVisible = alwaysVisible;
            if (!this.$horizScrollAlwaysVisible || !this.$horizScroll)
                this.$loop.schedule(this.CHANGE_SCROLL);
        }
    };

    this.$updateScrollBar = function() {
        this.scrollBar.setInnerHeight(this.layerConfig.maxHeight);
        this.scrollBar.setScrollTop(this.scrollTop);
    };

    this.$renderChanges = function(changes) {
        if (!changes || !this.session || !this.container.offsetWidth)
            return;

        this.layerConfig.changes = changes;
        // XXX
        //changes = this.CHANGE_FULL;

        console.log(changes);

        // text, scrolling and resize changes can cause the view port size to change
        if (changes & this.CHANGE_FULL ||
            changes & this.CHANGE_SIZE ||
            changes & this.CHANGE_TEXT ||
            changes & this.CHANGE_LINES ||
            changes & this.CHANGE_SCROLL
        )
            this.$computeLayerConfig();

        // horizontal scrolling
        if (changes & this.CHANGE_H_SCROLL) {
            this.scroller.scrollLeft = this.scrollLeft;

            // read the value after writing it since the value might get clipped
            var scrollLeft = this.scroller.scrollLeft;
            this.scrollLeft = scrollLeft;
            this.session.setScrollLeft(scrollLeft);
        }

        // full
        if (changes & this.CHANGE_FULL) {
            this.$textLayer.checkForSizeChanges();
            // update scrollbar first to not lose scroll position when gutter calls resize
            this.$updateScrollBar();
            this.$markerBack.update(this.layerConfig);
            this.$textLayer.update(this.layerConfig);
            this.$gutterLayer.update(this.layerConfig);
            this.$markerFront.update(this.layerConfig);
            this.$cursorLayer.update(this.layerConfig);
            this.$moveTextAreaToCursor();
            this.$highlightGutterLine && this.$updateGutterLineHighlight();
            //return;
        }

        // scrolling
        if (changes & this.CHANGE_SCROLL) {
            this.$updateScrollBar();
            if (changes & this.CHANGE_TEXT || changes & this.CHANGE_LINES)
                this.$textLayer.update(this.layerConfig);
            else
                this.$textLayer.scrollLines(this.layerConfig);

            if (this.showGutter)
                this.$gutterLayer.update(this.layerConfig);
            this.$markerBack.update(this.layerConfig);
            this.$markerFront.update(this.layerConfig);
            this.$cursorLayer.update(this.layerConfig);
            this.$moveTextAreaToCursor();
            this.$highlightGutterLine && this.$updateGutterLineHighlight();
            //return;
        }

        if (changes & this.CHANGE_TEXT) {
            this.$textLayer.update(this.layerConfig);
            if (this.showGutter)
                this.$gutterLayer.update(this.layerConfig);
        }
        else if (changes & this.CHANGE_LINES) {
            if (this.$updateLines()) {
                this.$updateScrollBar();
                if (this.showGutter)
                    this.$gutterLayer.update(this.layerConfig);
            }
        } else if (changes & this.CHANGE_GUTTER) {
            if (this.showGutter)
                this.$gutterLayer.update(this.layerConfig);
        }

        if (changes & this.CHANGE_CURSOR) {
            this.$cursorLayer.update(this.layerConfig);
            this.$moveTextAreaToCursor();
            this.$highlightGutterLine && this.$updateGutterLineHighlight();
        }

        if (changes & (this.CHANGE_MARKER | this.CHANGE_MARKER_FRONT)) {
            this.$markerFront.update(this.layerConfig);
        }

        if (changes & (this.CHANGE_MARKER | this.CHANGE_MARKER_BACK)) {
            this.$markerBack.update(this.layerConfig);
        }

        if (changes & this.CHANGE_SIZE)
            this.$updateScrollBar();

        if(!this.$60fps)
            this.$draw();
    };

    this.$draw = function() {
        /*
        this.$webgl.clear();
        if (this.showGutter)
            this.$gutterLayer.draw();
        this.$markerBack.update(this.layerConfig);
        this.$textLayer.draw();
        this.$markerFront.update(this.layerConfig);
        this.$cursorLayer.draw();
        */
        //this.$teflon.setVFlip(this.layerConfig.upsidedown ? 1 : -1);
        //this.$textLayer.draw();
    }

    this.$computeLayerConfig = function() {
        var session = this.session;

        var offset = this.scrollTop % this.lineHeight;
        var minHeight = this.$size.scrollerHeight + this.lineHeight;

        var longestLine = this.$getLongestLine();

        var horizScroll = this.$horizScrollAlwaysVisible || this.$size.scrollerWidth - longestLine < 0;
        var horizScrollChanged = this.$horizScroll !== horizScroll;
        this.$horizScroll = horizScroll;
        if (horizScrollChanged) {
            this.scroller.style.overflowX = horizScroll ? "scroll" : "hidden";
            // when we hide scrollbar scroll event isn't emited
            // leaving session with wrong scrollLeft value
            if (!horizScroll)
                this.session.setScrollLeft(0);
        }
        var maxHeight = this.session.getScreenLength() * this.lineHeight;
        this.session.setScrollTop(Math.max(0, Math.min(this.scrollTop, maxHeight - this.$size.scrollerHeight)));

        var lineCount = Math.ceil(minHeight / this.lineHeight) - 1;
        var firstRow = Math.max(0, Math.round((this.scrollTop - offset) / this.lineHeight));
        var lastRow = firstRow + lineCount;

        // Map lines on the screen to lines in the document.
        var firstRowScreen, firstRowHeight;
        var lineHeight = { lineHeight: this.lineHeight };
        firstRow = session.screenToDocumentRow(firstRow, 0);

        // Check if firstRow is inside of a foldLine. If true, then use the first
        // row of the foldLine.
        var foldLine = session.getFoldLine(firstRow);
        if (foldLine) {
            firstRow = foldLine.start.row;
        }

        firstRowScreen = session.documentToScreenRow(firstRow, 0);
        firstRowHeight = session.getRowHeight(lineHeight, firstRow);

        lastRow = Math.min(session.screenToDocumentRow(lastRow, 0), session.getLength() - 1);
        minHeight = this.$size.scrollerHeight + session.getRowHeight(lineHeight, lastRow)+
                                                firstRowHeight;

        offset = this.scrollTop - firstRowScreen * this.lineHeight;

        this.layerConfig = {
            width : longestLine,
            padding : this.$padding,
            firstRow : firstRow,
            firstRowScreen: firstRowScreen,
            lastRow : lastRow,
            lineHeight : this.lineHeight,
            characterWidth : this.characterWidth,
            minHeight : minHeight,
            maxHeight : maxHeight,
            height : this.$size.scrollerHeight,
            yOffset : offset,
            xOffset : this.showGutter ? 48 : 0,
            upsidedown : this.$upsidedown
        };

        this.setPadding(this.layerConfig.xOffset);

        // For debugging.
        // console.log(JSON.stringify(this.layerConfig));

        this.$gutter.style.marginTop = (-offset) + "px";
        //this.content.style.marginTop = (-offset) + "px";
        this.content.style.width = longestLine + 2 * this.$padding + "px";
        this.content.style.height = minHeight + "px";

        // Horizontal scrollbar visibility may have changed, which changes
        // the client height of the scroller
        if (horizScrollChanged)
            this.onResize(true);
    };

    this.$updateLines = function() {
        var firstRow = this.$changedLines.firstRow;
        var lastRow = this.$changedLines.lastRow;
        this.$changedLines = null;

        var layerConfig = this.layerConfig;

        // if the update changes the width of the document do a full redraw
        if (layerConfig.width != this.$getLongestLine())
            return this.$textLayer.update(layerConfig);

        if (firstRow > layerConfig.lastRow + 1) { return; }
        if (lastRow < layerConfig.firstRow) { return; }

        // if the last row is unknown -> redraw everything
        if (lastRow === Infinity) {
            if (this.showGutter)
                this.$gutterLayer.update(layerConfig);
            this.$textLayer.update(layerConfig);
            return;
        }

        // else update only the changed rows
        this.$textLayer.updateLines(layerConfig, firstRow, lastRow);
        return true;
    };

    this.$getLongestLine = function() {
        var charCount = this.session.getScreenWidth();
        if (this.$textLayer.showInvisibles)
            charCount += 1;

        return Math.max(this.$size.scrollerWidth - 2 * this.$padding, Math.round(charCount * this.characterWidth));
    };

    /**
    * VirtualRenderer.updateFrontMarkers() -> Void
    *
    * Schedules an update to all the front markers in the document.
    **/
    this.updateFrontMarkers = function() {
        this.$markerFront.setMarkers(this.session.getMarkers(true));
        this.$loop.schedule(this.CHANGE_MARKER_FRONT);
    };

    /**
    * VirtualRenderer.updateBackMarkers() -> Void
    *
    * Schedules an update to all the back markers in the document.
    **/
    this.updateBackMarkers = function() {
        this.$markerBack.setMarkers(this.session.getMarkers());
        this.$loop.schedule(this.CHANGE_MARKER_BACK);
    };

    /**
    * VirtualRenderer.addGutterDecoration(row, className) -> Void
    * - row (Number): The row number
    * - className (String): The class to add
    *
    * Adds `className` to the `row`, to be used for CSS stylings and whatnot.
    **/
    this.addGutterDecoration = function(row, className){
        this.$gutterLayer.addGutterDecoration(row, className);
        this.$loop.schedule(this.CHANGE_GUTTER);
    };

    /**
    * VirtualRenderer.removeGutterDecoration(row, className)-> Void
    * - row (Number): The row number
    * - className (String): The class to add
    *
    * Removes `className` from the `row`.
    **/
    this.removeGutterDecoration = function(row, className){
        this.$gutterLayer.removeGutterDecoration(row, className);
        this.$loop.schedule(this.CHANGE_GUTTER);
    };

    /**
    * VirtualRenderer.setBreakpoints(rows) -> Void
    * - rows (Array): An array containg row numbers
    *
    * Sets a breakpoint for every row number indicated on `rows`.
    **/
    this.setBreakpoints = function(rows) {
        this.$gutterLayer.setBreakpoints(rows);
        this.$loop.schedule(this.CHANGE_GUTTER);
    };

    /**
    * VirtualRenderer.setAnnotations(annotations) -> Void
    * - annotations (Array): An array containing annotations
    *
    * Sets annotations for the gutter.
    **/
    this.setAnnotations = function(annotations) {
        this.$gutterLayer.setAnnotations(annotations);
        this.$loop.schedule(this.CHANGE_GUTTER);
    };

    /**
    * VirtualRenderer.updateCursor() -> Void
    *
    * Updates the cursor icon.
    **/
    this.updateCursor = function() {
        this.$loop.schedule(this.CHANGE_CURSOR);
    };

    /**
    * VirtualRenderer.hideCursor() -> Void
    *
    * Hides the cursor icon.
    **/
    this.hideCursor = function() {
        this.$cursorLayer.hideCursor();
    };

    /**
    * VirtualRenderer.showCursor() -> Void
    *
    * Shows the cursor icon.
    **/
    this.showCursor = function() {
        this.$cursorLayer.showCursor();
    };

    this.scrollSelectionIntoView = function(anchor, lead, offset) {
        // first scroll anchor into view then scroll lead into view
        this.scrollCursorIntoView(anchor, offset);
        this.scrollCursorIntoView(lead, offset);
    };

    /**
    * VirtualRenderer.scrollCursorIntoView(cursor, offset) -> Void
    *
    * Scrolls the cursor into the first visibile area of the editor
    **/
    this.scrollCursorIntoView = function(cursor, offset) {
        // the editor is not visible
        if (this.$size.scrollerHeight === 0)
            return;

        var pos = this.$cursorLayer.getPixelPosition(cursor);

        var left = pos.left;
        var top = pos.top;

        if (this.scrollTop > top) {
            if (offset)
                top -= offset * this.$size.scrollerHeight;
            this.session.setScrollTop(top);
        } else if (this.scrollTop + this.$size.scrollerHeight < top + this.lineHeight) {
            if (offset)
                top += offset * this.$size.scrollerHeight;
            this.session.setScrollTop(top + this.lineHeight - this.$size.scrollerHeight);
        }

        var scrollLeft = this.scrollLeft;

        if (scrollLeft > left) {
            if (left < this.$padding + 2 * this.layerConfig.characterWidth)
                left = 0;
            this.session.setScrollLeft(left);
        } else if (scrollLeft + this.$size.scrollerWidth < left + this.characterWidth) {
            this.session.setScrollLeft(Math.round(left + this.characterWidth - this.$size.scrollerWidth));
        }
    };

    /** related to: EditSession.getScrollTop
    * VirtualRenderer.getScrollTop() -> Number
    *
    * {:EditSession.getScrollTop}
    **/
    this.getScrollTop = function() {
        return this.session.getScrollTop();
    };

    /** related to: EditSession.getScrollLeft
    * VirtualRenderer.getScrollLeft() -> Number
    *
    * {:EditSession.getScrollLeft}
    **/
    this.getScrollLeft = function() {
        return this.session.getScrollLeft();
    };

    /**
    * VirtualRenderer.getScrollTopRow() -> Number
    *
    * Returns the first visible row, regardless of whether it's fully visible or not.
    **/
    this.getScrollTopRow = function() {
        return this.scrollTop / this.lineHeight;
    };

    /**
    * VirtualRenderer.getScrollBottomRow() -> Number
    *
    * Returns the last visible row, regardless of whether it's fully visible or not.
    **/
    this.getScrollBottomRow = function() {
        return Math.max(0, Math.floor((this.scrollTop + this.$size.scrollerHeight) / this.lineHeight) - 1);
    };

    /** related to: EditSession.setScrollTop
    * VirtualRenderer.scrollToRow(row) -> Void
    * - row (Number): A row id
    *
    * Gracefully scrolls the top of the editor to the row indicated.
    **/
    this.scrollToRow = function(row) {
        this.session.setScrollTop(row * this.lineHeight);
    };

    this.STEPS = 8;
    this.$calcSteps = function(fromValue, toValue){
        var i = 0;
        var l = this.STEPS;
        var steps = [];

        var func  = function(t, x_min, dx) {
            return dx * (Math.pow(t - 1, 3) + 1) + x_min;
        };

        for (i = 0; i < l; ++i)
            steps.push(func(i / this.STEPS, fromValue, toValue - fromValue));

        return steps;
    };

    /** 
    * VirtualRenderer.scrollToLine(line, center, animate, callback) -> Void
    * - line (Number): A line number
    * - center (Boolean): If `true`, centers the editor the to indicated line
    * - animate (Boolean): If `true` animates scrolling
    * - callback (Function): Function to be called after the animation has finished
    * 
    * Gracefully scrolls the editor to the row indicated.
    **/
    this.scrollToLine = function(line, center, animate, callback) {
        var pos = this.$cursorLayer.getPixelPosition({row: line, column: 0});
        var offset = pos.top;
        if (center)
            offset -= this.$size.scrollerHeight / 2;

        var initialScroll = this.scrollTop;
        this.session.setScrollTop(offset);
        if (animate !== false)
            this.animateScrolling(initialScroll, callback);
    };

    this.animateScrolling = function(fromValue, callback) {
        var toValue = this.scrollTop;
        if (this.$animatedScroll && Math.abs(fromValue - toValue) < 100000) {
            var _self = this;
            var steps = _self.$calcSteps(fromValue, toValue);
            this.$inScrollAnimation = true;
            
            clearInterval(this.$timer);

            _self.session.setScrollTop(steps.shift());
            this.$timer = setInterval(function() {
                if (steps.length) {
                    _self.session.setScrollTop(steps.shift());
                    // trick session to think it's already scrolled to not loose toValue
                    _self.session.$scrollTop = toValue;
                } else {
                    this.$inScrollAnimation = false;
                    clearInterval(_self.$timer);
                    
                    _self.session.$scrollTop = -1;
                    _self.session.setScrollTop(toValue);
                     callback &&  callback();
                }
            }, 10);
        }
    };
    
    /**
    * VirtualRenderer.scrollToY(scrollTop) -> Number
    * - scrollTop (Number): The position to scroll to
    *
    * Scrolls the editor to the y pixel indicated.
    *
    **/
    this.scrollToY = function(scrollTop) {
        // after calling scrollBar.setScrollTop
        // scrollbar sends us event with same scrollTop. ignore it
        if (this.scrollTop !== scrollTop) {
            this.$loop.schedule(this.CHANGE_SCROLL);
            this.scrollTop = scrollTop;
        }
    };

    /**
    * VirtualRenderer.scrollToX(scrollLeft) -> Number
    * - scrollLeft (Number): The position to scroll to
    *
    * Scrolls the editor to the x pixel indicated.
    *
    **/
    this.scrollToX = function(scrollLeft) {
        if (scrollLeft <= this.$padding)
            scrollLeft = 0;

        if (this.scrollLeft !== scrollLeft)
            this.scrollLeft = scrollLeft;
        this.$loop.schedule(this.CHANGE_H_SCROLL);
    };

    /**
    * VirtualRenderer.scrollBy(deltaX, deltaY) -> Void
    * - deltaX (Number): The x value to scroll by
    * - deltaY (Number): The y value to scroll by
    *
    * Scrolls the editor across both x- and y-axes.
    **/
    this.scrollBy = function(deltaX, deltaY) {
        deltaY && this.session.setScrollTop(this.session.getScrollTop() + deltaY);
        deltaX && this.session.setScrollLeft(this.session.getScrollLeft() + deltaX);
    };

    /**
    * VirtualRenderer.isScrollableBy(deltaX, deltaY) -> Boolean
    * - deltaX (Number): The x value to scroll by
    * - deltaY (Number): The y value to scroll by
    *
    * Returns `true` if you can still scroll by either parameter; in other words, you haven't reached the end of the file or line.
    **/
    this.isScrollableBy = function(deltaX, deltaY) {
        if (deltaY < 0 && this.session.getScrollTop() > 0)
           return true;
        if (deltaY > 0 && this.session.getScrollTop() + this.$size.scrollerHeight < this.layerConfig.maxHeight)
           return true;
        // todo: handle horizontal scrolling
    };

    this.pixelToScreenCoordinates = function(x, y) {
        var canvasPos = this.container.getBoundingClientRect();

        var offset = (x + this.scrollLeft - canvasPos.left - this.$padding - this.layerConfig.xOffset) / this.characterWidth;
        var row = Math.floor((y + this.scrollTop - canvasPos.top) / this.lineHeight);
        var col = Math.round(offset);

        return {row: row, column: col, side: offset - col > 0 ? 1 : -1};
    };

    this.screenToTextCoordinates = function(x, y) {
        var canvasPos = this.container.getBoundingClientRect();

        var col = Math.round(
            (x + this.scrollLeft - canvasPos.left - this.$padding - this.layerConfig.xOffset) / this.characterWidth
        );
        var row = Math.floor(
            (y + this.scrollTop - canvasPos.top) / this.lineHeight
        );

        return this.session.screenToDocumentPosition(row, Math.max(col, 0));
    };

    /**
    * VirtualRenderer.textToScreenCoordinates(row, column) -> Object
    * - row (Number): The document row position
    * - column (Number): The document column position
    *
    * Returns an object containing the `pageX` and `pageY` coordinates of the document position.
    *
    *
    **/
    this.textToScreenCoordinates = function(row, column) {
        var canvasPos = this.container.getBoundingClientRect();
        var pos = this.session.documentToScreenPosition(row, column);

        var x = this.$padding + Math.round(pos.column * this.characterWidth);
        var y = pos.row * this.lineHeight;

        return {
            pageX: canvasPos.left + x - this.scrollLeft - this.layerConfig.xOffset,
            pageY: canvasPos.top + y - this.scrollTop
        };
    };

    /**
    * VirtualRenderer.visualizeFocus() -> Void
    *
    * Focuses the current container.
    **/
    this.visualizeFocus = function() {
        dom.addCssClass(this.container, "ace_focus");
    };

    /**
    * VirtualRenderer.visualizeBlur() -> Void
    *
    * Blurs the current container.
    **/
    this.visualizeBlur = function() {
        dom.removeCssClass(this.container, "ace_focus");
    };

    /** internal, hide
    * VirtualRenderer.showComposition(position) -> Void
    * - position (Number):
    *
    **/
    this.showComposition = function(position) {
        if (!this.$composition) {
            this.$composition = dom.createElement("div");
            this.$composition.className = "ace_composition";
            this.content.appendChild(this.$composition);
        }

        this.$composition.innerHTML = "&#160;";

        var pos = this.$cursorLayer.getPixelPosition();
        var style = this.$composition.style;
        style.top = pos.top + "px";
        style.left = (pos.left + this.$padding) + "px";
        style.height = this.lineHeight + "px";

        this.hideCursor();
    };

    /**
    * VirtualRenderer.setCompositionText(text) -> Void
    * - text (String): A string of text to use
    *
    * Sets the inner text of the current composition to `text`.
    **/
    this.setCompositionText = function(text) {
        dom.setInnerText(this.$composition, text);
    };

    /**
    * VirtualRenderer.hideComposition() -> Void
    *
    * Hides the current composition.
    **/
    this.hideComposition = function() {
        this.showCursor();

        if (!this.$composition)
            return;

        var style = this.$composition.style;
        style.top = "-10000px";
        style.left = "-10000px";
    };

    this._loadTheme = function(name, callback) {
        if (!config.get("packaged"))
            return callback();

        var base = name.split("/").pop();
        var filename = config.get("themePath") + "/theme-" + base + config.get("suffix");
        net.loadScript(filename, callback);
    };

    /**
    * VirtualRenderer.setTheme(theme) -> Void
    * - theme (String): The path to a theme
    *
    * [Sets a new theme for the editor. `theme` should exist, and be a directory path, like `ace/theme/textmate`.]{: #VirtualRenderer.setTheme}
    **/
    this.setTheme = function(theme) {
        var _self = this;

        this.$themeValue = theme;
        if (!theme || typeof theme == "string") {
            var moduleName = theme || "ace/theme/textmate";

            var module;
            try {
                module = require(moduleName);
            } catch (e) {};
            if (module)
                return afterLoad(module);

            _self._loadTheme(moduleName, function() {
                require([moduleName], function(module) {
                    if (_self.$themeValue !== theme)
                        return;

                    afterLoad(module);
                });
            });
        } else {
            afterLoad(theme);
        }

        function afterLoad(theme) {
            dom.importCssString(
                theme.cssText,
                theme.cssClass,
                _self.container.ownerDocument
            );

            if(_self.$textLayer   !== undefined) _self.$textLayer.invalidateStyleCache();
            if(_self.$markerBack  !== undefined) _self.$markerBack.invalidateStyleCache();
            if(_self.$markerFront !== undefined) _self.$markerFront.invalidateStyleCache();

            if (_self.$theme)
                dom.removeCssClass(_self.container, _self.$theme);

            _self.$theme = theme ? theme.cssClass : null;

            if (_self.$theme)
                dom.addCssClass(_self.container, _self.$theme);

            if (theme && theme.isDark)
                dom.addCssClass(_self.container, "ace_dark");
            else
                dom.removeCssClass(_self.container, "ace_dark");

            
            var b = dom.computedStyle(_self.$hidden, "background-color");
            if(b.length == 4)
                //_self.$webgl.setClearColor(1, 1, 1);                     
                _self.$textViewer.updateOptions({bgColor : "#ffffff"});
            else
                //_self.$webgl.setClearColor(b[0] / 255, b[1] /  255, b[2] / 255);                     
                _self.$textViewer.updateOptions({bgColor : b});

            // force re-measure of the gutter width
            if (_self.$size) {
                _self.$size.width = 0;
                _self.onResize();
            }
        }
    };

    /**
    * VirtualRenderer.getTheme() -> String
    *
    * [Returns the path of the current theme.]{: #VirtualRenderer.getTheme}
    **/
    this.getTheme = function() {
        return this.$themeValue;
    };

    // Methods allows to add / remove CSS classnames to the editor element.
    // This feature can be used by plug-ins to provide a visual indication of
    // a certain mode that editor is in.

    /**
    * VirtualRenderer.setStyle(style) -> Void
    * - style (String): A class name
    *
    * [Adds a new class, `style`, to the editor.]{: #VirtualRenderer.setStyle}
    **/
    this.setStyle = function setStyle(style) {
      dom.addCssClass(this.container, style);
    };

    /**
    * VirtualRenderer.unsetStyle(style) -> Void
    * - style (String): A class name
    *
    * [Removes the class `style` from the editor.]{: #VirtualRenderer.unsetStyle}
    **/
    this.unsetStyle = function unsetStyle(style) {
      dom.removeCssClass(this.container, style);
    };

    this.createDefaultPalette = function() {
        return this.$teflon.createPalette(
            [
            'rgb(0, 0, 0)', 'rgb(0, 0, 162)', 'rgb(0, 0, 205)', 'rgb(0, 0, 255)', 'rgb(0, 0, 64)', 'rgb(0, 102, 255)', 'rgb(0, 136, 255)', 'rgb(0, 64, 128)', 'rgb(100, 139, 210)', 'rgb(101, 123, 131)',
            'rgb(102, 108, 104)', 'rgb(102, 153, 204)', 'rgb(102, 169, 104)', 'rgb(102, 204, 204)', 'rgb(102, 217, 239)', 'rgb(102, 255, 0)', 'rgb(104, 118, 135)', 'rgb(105, 58, 23)', 'rgb(108, 153, 187)', 'rgb(11, 97, 37)',
            'rgb(112, 109, 91)', 'rgb(112, 192, 177)', 'rgb(113, 140, 0)', 'rgb(114, 133, 183)', 'rgb(117, 113, 94)', 'rgb(117, 122, 216)', 'rgb(117, 135, 166)', 'rgb(121, 120, 120)', 'rgb(121, 73, 56)', 'rgb(122, 166, 218)',
            'rgb(127, 0, 127)', 'rgb(127, 0, 85)', 'rgb(127, 159, 191)', 'rgb(127, 197, 120)', 'rgb(128, 0, 128)', 'rgb(128, 159, 191)', 'rgb(128, 255, 194)', 'rgb(129, 162, 190)', 'rgb(129, 31, 36)', 'rgb(133, 135, 58)',
            'rgb(133, 153, 0)', 'rgb(137, 89, 168)', 'rgb(138, 190, 183)', 'rgb(141, 255, 10)', 'rgb(142, 144, 140)', 'rgb(142, 198, 95)', 'rgb(143, 147, 143)', 'rgb(143, 157, 106)', 'rgb(146, 124, 93)', 'rgb(146, 146, 146)',
            'rgb(147, 15, 128)', 'rgb(147, 161, 161)', 'rgb(148, 156, 139)', 'rgb(150, 152, 150)', 'rgb(153, 153, 153)', 'rgb(153, 204, 153)', 'rgb(153, 255, 255)', 'rgb(153, 51, 204)', 'rgb(153, 68, 9)', 'rgb(163, 158, 100)',
            'rgb(165, 194, 97)', 'rgb(166, 198, 255)', 'rgb(166, 226, 46)', 'rgb(167, 29, 93)', 'rgb(168, 179, 171)', 'rgb(172, 136, 91)', 'rgb(172, 75, 184)', 'rgb(173, 46, 164)', 'rgb(174, 129, 255)', 'rgb(174, 178, 248)',
            'rgb(175, 149, 111)', 'rgb(178, 148, 187)', 'rgb(180, 55, 31)', 'rgb(181, 137, 0)', 'rgb(181, 189, 104)', 'rgb(184, 52, 38)', 'rgb(185, 202, 74)', 'rgb(187, 218, 255)', 'rgb(188, 148, 88)', 'rgb(188, 200, 186)',
            'rgb(190, 191, 85)', 'rgb(192, 0, 0)', 'rgb(193, 193, 68)', 'rgb(194, 126, 102)', 'rgb(194, 59, 0)', 'rgb(195, 151, 216)', 'rgb(197, 200, 198)', 'rgb(197, 39, 39)', 'rgb(200, 117, 0)', 'rgb(200, 40, 41)',
            'rgb(204, 102, 102)', 'rgb(204, 120, 51)', 'rgb(204, 153, 204)', 'rgb(204, 204, 204)', 'rgb(204, 204, 51)', 'rgb(205, 168, 105)', 'rgb(207, 106, 76)', 'rgb(207, 86, 40)', 'rgb(209, 167, 150)', 'rgb(209, 241, 169)',
            'rgb(211, 1, 2)', 'rgb(211, 54, 130)', 'rgb(213, 78, 83)', 'rgb(218, 208, 133)', 'rgb(222, 142, 48)', 'rgb(222, 147, 95)', 'rgb(222, 222, 222)', 'rgb(225, 197, 130)', 'rgb(230, 219, 116)', 'rgb(230, 225, 220)',
            'rgb(231, 140, 69)', 'rgb(233, 136, 0)', 'rgb(233, 192, 98)', 'rgb(233, 46, 46)', 'rgb(235, 147, 154)', 'rgb(235, 187, 255)', 'rgb(242, 119, 122)', 'rgb(245, 135, 31)', 'rgb(248, 248, 242)', 'rgb(248, 248, 248)',
            'rgb(249, 145, 87)', 'rgb(249, 238, 152)', 'rgb(249, 38, 114)', 'rgb(252, 111, 9)', 'rgb(252, 128, 58)', 'rgb(252, 255, 224)', 'rgb(253, 151, 31)', 'rgb(253, 194, 81)', 'rgb(255, 102, 0)', 'rgb(255, 128, 225)',
            'rgb(255, 156, 0)', 'rgb(255, 157, 0)', 'rgb(255, 157, 164)', 'rgb(255, 176, 84)', 'rgb(255, 197, 143)', 'rgb(255, 198, 109)', 'rgb(255, 204, 0)', 'rgb(255, 238, 128)', 'rgb(255, 255, 255)', 'rgb(255, 98, 140)',
            'rgb(3, 106, 7)', 'rgb(35, 110, 36)', 'rgb(35, 74, 151)', 'rgb(38, 139, 210)', 'rgb(42, 0, 255)', 'rgb(42, 161, 152)', 'rgb(49, 132, 149)', 'rgb(51, 153, 153)', 'rgb(57, 148, 106)', 'rgb(6, 150, 14)',
            'rgb(60, 64, 59)', 'rgb(60, 76, 114)', 'rgb(62, 153, 159)', 'rgb(63, 127, 95)', 'rgb(63, 95, 191)', 'rgb(64, 64, 64)', 'rgb(66, 113, 174)', 'rgb(68, 180, 204)', 'rgb(7, 54, 66)', 'rgb(70, 166, 9)',
            'rgb(72, 72, 72)', 'rgb(75, 75, 75)', 'rgb(76, 136, 107)', 'rgb(77, 77, 76)', 'rgb(79, 183, 197)', 'rgb(8, 8, 8)', 'rgb(88, 110, 117)', 'rgb(88, 142, 96)', 'rgb(88, 197, 84)', 'rgb(88, 92, 246)',
            'rgb(90, 82, 95)', 'rgb(93, 144, 205)', 'rgb(95, 90, 96)', 'rgba(125, 255, 192, 0.648438)', 'rgba(210, 117, 24, 0.757813)'
         ]);
    };

    /**
    * VirtualRenderer.destroy()
    *
    * Destroys the text and cursor layers for this renderer.
    **/
    this.destroy = function() {
        this.$textLayer.destroy();
        this.$cursorLayer.destroy();
    };
}).call(VirtualRenderer.prototype);

exports.VirtualRenderer = VirtualRenderer;
});
