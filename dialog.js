//
// dialog.js
//
// Library for providing modal dialog interaction.
//
// Dependencies [ender.js]
//  - qwery
//  - bonzo
//  - bean
//
;(function (global, undefined) {
    'use strict';

function Dialog(opts) {
    var context = this;
    context = _extend(context, opts || {});
    if (context.preLoad)
        _preLoadDialog(context);
}

Dialog.prototype = {
    type: 'dialog',         // root class or id used for lookup
    classes: [],            // additional classes to add to root element
    preLoad: false,
    fade: false,
    modal: true,
    hideOnOverlayClick: true,
    overlay: 'overlay',
    url: '',
    onShow: function () {},
    onHide: function () {},
    overlayElement: null,
    dialogElement: null
};

// Dialog content
Dialog.prototype.content = [
    {
        name: 'title',
        text: 'Dialog Title'
    },
    {
        name: 'heading',
        text: 'Dialog Heading'
    },
    {
        name: 'message',
        text: 'Dialog Message'
    }
];

// Default dialog button options
Dialog.prototype.buttons = [
    {   // Footer ok button
        name: 'button-ok',
        container: 'action-buttons',
        generate: true,
        events: {
            'click': function () {}
        }
    },
    {   // Header close button
        name: 'button-close',
        container: 'header',
        generate: true,
        text: 'x',
        events: {
            'click': function () {}
        }
    }
];

// Show a dialog
Dialog.prototype.show = function (opts) {
    var context = this;
    context = _extend(context, opts || {});
    
//    var overlay = context.overlayElement();
//    if (context.useOverlay)
//        _showOverlay(overlay, context.onShow, context.onHide);

    // Obtain a DOM Element for the dialog
    var dialogElement = _checkDialog(context);
    if ('undefined' === typeof dialogElement) {
        _fetchDialog(context.url, function(e) {
            context.dialogElement = dialogElement;
            _fillDialog(context);
        });
    } else {
        if (!context.preLoad)
            _fillDialog(context, true);
        else
            _show(context);
    }
};

// Hide a dialog
Dialog.prototype.hide = function() {
    var context = this;
    _hide(context);
};

// Set (or update) a dialog content item
Dialog.prototype.setContent = function(content, selector) {
    var contentSelector;
    if ('undefined' === typeof selector)
        contentSelector = $(_getSelector(content.name), this.dialogElement);
    else
        contentSelector = selector;

    if ('undefined' === typeof contentSelector || ('object' === typeof contentSelector && contentSelector.length < 1)) {
        _log('setContentItem could not find an element');
        return;
    }

    if (content.text)
        $(contentSelector).text(content.text);
    if (content.val)
        $(contentSelector).val(content.val);
    if (content.html)
        $(contentSelector).html(content.html);
    
    if ('undefined' !== typeof content.atts)
        for (var k in content.atts)
            $(contentSelector).attr(k, content.atts[k]);
};

// Set (or update) a dialog button item
Dialog.prototype.setButton = function(button) {
    var selector = _getSelector(button.name);
    var buttonSelector = $(selector, this.dialogElement);

    // If this button does not exist, add it (if specified)
    if (('undefined' === typeof buttonSelector || buttonSelector.length < 1) && button.generate) {
        var containerSelector = _getSelector(button.container);
        var html = _generateButtonHtml(button);
        if (null === containerSelector)
            $(this.dialogElement).append(html);
        else
            $(containerSelector, this.dialogElement).append(html);

        buttonSelector = $(selector, this.dialogElement);
    }

    // Buttons can also have text, val and html
    this.setContent(button, buttonSelector);

    // Hook up events
    if ('object' === typeof button.events) {
        for (var evt in button.events)
            $(buttonSelector).on(evt, button.events[evt]);
    }
};

// Add a new content item (useful if we have already filled the dialog)
Dialog.prototype.addContent = function(content) {
    this.content.push(content);
    this.setContent(content);
};

// Add a new button (useful if we have already filled the dialog)
Dialog.prototype.addButton = function(button) {
    this.buttons.push(button);
    this.setButton(button);
};

// Destroy a dialog
Dialog.prototype.destroy = function() {
    // TODO
};

//
// Private Methods
//

// Pre load a dialog
var _preLoadDialog = function(context) {
    _async(function() {
        context.dialogElement = _checkDialog(context);
        if ('undefined' === typeof context.dialogElement) {
            if (context.url === null || context.url.length == 0) {
                _log('unable to locate a dialog on the DOM, and URL is not set');
                return;
            }
            _fetchDialog(context.url,
                function (e) {
                    context.dialogElement = e;
                    _fillDialog(context);
                },
                function () {
                    _log('unable to fetch dialog from the server!');
                });
        }
    });
};

// Fill a dialog with content
var _fillDialog = function(context, show) {
    // Add additional root classes if specified
    if ('string' == typeof context.classes)
        $(context.dialogElement).toggleClass(context.classes);
    else if (Array == typeof context.classes.constructor)
        for (var klass in context.classes)
            $(context.dialogElement).toggleClass(klass);

    // Content
    for (var c in context.content)
        context.setContent(context.content[c]);

    // Buttons
    for (var b in context.buttons)
        context.setButton(context.buttons[b]);

    if (show)
        _show(context);
};

var _show = function(context) {
    $(context.dialogElement)[0].style.display = "block";
    if ('function' === typeof context.onShow)
        context.onShow(context);
};

var _hide = function(context) {
    $(context.dialogElement)[0].style.display = "none";
    if ('function' === typeof context.onHide)
        context.onHide(context);
};

// Clear content from a dialog
var _clearDialog = function(context) {
    // TODO
};

// Obtain a class or ID selector
var _getSelector = function(selector) {
    if ('string' !== typeof selector)
        return null;
    return selector[0] == '#' ? selector[0] :
        (selector[0] == '.' ? selector : '.' + selector);
};

// Check if the dialogElement exists
var _checkDialog = function(context) {
    if (null !== context.dialogElement)
        return context.dialogElement;

    return $(_getSelector(context.type))[0];
};

// Retreive a dialog from a URL (DOM Element)
var _fetchDialog = function(url, success, err) {
    if (null === url || url.length == 0) {
        _log('_fetchDialog called without a URL!');
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                // Inject the dialog
                global.document.body.insertAdjacentHTML("beforeend", this.responseText);
                if ('function' === typeof(success)) {
                    var i = global.document.body.children.length - 1;
                    success(global.document.body.children[i]);
                }
            } else {
                if ('function' === typeof(err))
                    err();
            };
        }
    };
    xhr.open('GET', url, true);
    xhr.send('');
};

// Show the overlay
var _showOverlay = function(context) {
    element.style.display = "block";
    element.onclick = _hideOverlay(element, onHide);
};

// Hide the overlay
var _hideOverlay = function(context, onHide) {
    element.style.display = "none";
    element.onclick = null;
};

// Extend implemenation
var _extend = function(target, source) {
    target = target || {};
    for (var prop in source) {
        if ('object' === typeof source[prop].constructor)
            target[prop] = extend(target[prop], source[prop]);
        else
            target[prop] = source[prop];
    }
    return target;
};

// Generate a small HTML snippet for a button
var _generateButtonHtml = function(b) {
    return '<div class="' + b.name + '"></div>';
};

// Do something in the background
var _async = function(fn) {
    setTimeout(fn, 20);
};

var _log = function(msg) {
    if (window.console && console.log)
        console.log(msg);
};

// Expose
if (typeof define === 'function' && define.amd)
    define(function() { return Dialog; });
else
    global.Dialog = Dialog;

})(this);
