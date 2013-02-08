/*!
 * dialog.js
 * (c) Dan Jarvis 2012 - License MIT
 */
;(function (global, undefined) {
    'use strict';
function Dialog(opts) {
    var context = this;
    context = _extend(context, opts || {});
    if (context.preload)
        _preloadDialog(context);

    // Setup the show trigger if specified
    if (context.trigger.selector && context.trigger.event) {
        $(context.trigger.selector).on(context.trigger.event, function (e, dialog) {
            dialog.show();
        }, context);
    }
}

Dialog.prototype = {
    selector: '.dialog',
    classes: [],
    attributes: {},
    preload: true,
    animate: false,
    modal: true,
    hideOnOverlayClick: true,
    overlay: '.overlay',
    url: '',
    shown: undefined,
    hidden: undefined,
    overlayElement: null,
    dialogElement: null,
    trigger: {},
    content: {},
    buttons: {}
};

// Show a dialog
Dialog.prototype.show = function (opts) {
    var context = this;
    context = _extend(context, opts || {});

    // Obtain a DOM Element for the dialog
    var dialogElement = _checkDialog(context);
    if ('undefined' === typeof dialogElement) {
        _fetchDialog(context.url, function(e) {
            context.dialogElement = dialogElement;
            _fillDialog(context);
        });
    } else {
        if (!context.preload)
            _fillDialog(context, true);
        else
            _show(context);
    }
};

// Hide a dialog
Dialog.prototype.hide = function() {
    _hide(this);
};

// Lookup an existing content item and fill the dialog accordingly
// <key> should be a key in this.content, represents the selector
// <selector> if specified, use this is the selector instead of key
Dialog.prototype.setContent = function(key, isButton, selector) {
    var contentItem = isButton ? this.buttons[key] : this.content[key];
    if ('undefined' === contentItem) {
        _log('setContentItem encountered an invalid key: ' + key);
        return;
    }

    var contentSelector;
    if ('undefined' === typeof selector)
        contentSelector = $(key, this.dialogElement);
    else
        contentSelector = selector;

    if ('undefined' === typeof contentSelector || ('object' === typeof contentSelector && contentSelector.length < 1)) {
        //_log('setContentItem could not find an element');
        return;
    }

    if (contentItem.text)
        $(contentSelector).text(contentItem.text);
    if (contentItem.html)
        $(contentSelector).html(contentItem.html);

    _addClasses(contentItem.classes, contentSelector);
    _addAttributes(contentItem.attributes, contentSelector);
};

// Lookup an existing button item and fill the dialog accordingly
// <key> should be a key in this.buttons, represents the selector
Dialog.prototype.setButton = function(key) {
    var buttonItem = this.buttons[key];
    if ('undefined' === typeof buttonItem) {
        _log('setButtonItem encountered an invalid key: ' + key);
        return;
    }

    var buttonSelector = $(key, this.dialogElement);

    // If this button does not exist, add it (if specified)
    if (('undefined' === typeof buttonSelector || buttonSelector.length < 1) && buttonItem.generate) {
        var html = _generateButtonHtml(key, buttonItem);
        if ('undefined' === typeof buttonItem.container)
            $(this.dialogElement).append(html);
        else
            $(buttonItem.container, this.dialogElement).append(html);

        buttonSelector = $(key, this.dialogElement);
    }

    // Buttons can also have the same properties as content items.
    this.setContent(key, true, buttonSelector);

    // Hook up events
    if ('object' === typeof buttonItem.events) {
        for (var evt in buttonItem.events)
            $(buttonSelector).on(evt, buttonItem.events[evt], this);
    }
};

// Add or update this.content and change the dialog
Dialog.prototype.updateContent = function(key, content) {
    if ('object' !== typeof content)
        return;

    if ('undefined' === typeof this.content[key])
        this.content[key] = content;
    this.setContent(key);
};

// Add or update this.buttons and change the dialog
Dialog.prototype.addButton = function(key, button) {
    if ('object' !== typeof button)
        return;

    if ('undefined' === typeof this.buttons[key])
        this.buttons[key] = button;
    this.setButton(key);
};

// Destroy a dialog.
//  - remove any events attached to elements we know about
//  - remove the dialog from the DOM
Dialog.prototype.destroy = function() {
   var context = this;
   if (context.trigger.selector && context.trigger.event)
       $(context.trigger.selector).off(context.trigger.event);

   if ('object' === typeof context.buttons) {
       for (var b in context.buttons) {
           if ('object' === typeof b.events)
               for (var evt in b.events)
                   $(b.selector, context.dialogElement).off(evt);
       }
   }

   if (context.modal) {
       _hideOverlay(context, function() {
           $(context.overlayElement).off('click');
       });
   }
   $(context.dialogElement).remove();
};

/*
 * Private Methods
 */

// Pre load a dialog
var _preloadDialog = function(context) {
    _async(function() {
        context.dialogElement = _checkDialog(context);
        if ('undefined' === typeof context.dialogElement) {
            if (context.url === null || context.url.length === 0) {
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
    _addClasses(context.classes, context.dialogElement);

    // Content
    if ('object' === typeof context.content)
        for (var c in context.content)
            context.setContent(c, false);

    // Buttons
    if ('object' === typeof context.buttons)
        for (var b in context.buttons)
            context.setButton(b);

    if (show)
        _show(context);
};

var _show = function(context) {
    if (context.modal) {
        _showOverlay(context, function() {
            _showDialog(context, function() {
                if ('function' === typeof context.shown) {
                    context.shown(context);
                }
            });
        });
    } else {
        _showDialog(context, function() {
            if ('function' === typeof context.shown)
                context.shown(context);
        });
    }
};

var _hide = function(context) {
    if (context.modal) {
        _hideDialog(context, function() {
            _hideOverlay(context, function() {
                if ('function' === typeof context.hidden)
                    context.hidden(context);
            });
        });
    } else {
        _hideDialog(context, function() {
            if ('function' === typeof context.hidden)
                context.hidden(context);
        });
    }
};

var _showOverlay = function(context, onComplete) {
    if (null === context.overlayElement)
        context.overlayElement = _createOverlay(context);

    if (context.hideOnOverlayClick) {
        $(context.overlayElement).on('click', function() {
            context.hide();
        });
    }

    if (context.animate) {
        $(context.overlayElement).css({
            display: 'block',
            opacity: 0
        })
        .animate({
            opacity: 0.8,
            duration: 250,
            complete: onComplete
        });
    } else {
        $(context.overlayElement).show('block');
        if ('function' === typeof onComplete)
            onComplete();
    }
};

var _hideOverlay = function(context, onComplete) {
    if (context.hideOnOverlayClick)
        $(context.overlayElement).on('click', null);

    if (context.animate) {
        $(context.overlayElement).animate({
            display: 'none',
            opacity: 0,
            duration: 250,
            complete: function() {
                $(context.overlayElement).hide();
                if ('function' === typeof onComplete)
                    onComplete();
            }
        });
    } else {
        $(context.overlayElement).hide();
        if ('function' === typeof onComplete)
            onComplete();
    }
};

var _showDialog = function(context, onComplete) {
    if (context.animate) {
        $(context.dialogElement).css({
            display: 'block',
            'margin-top': '-1000px'
        })
        .animate({
            'margin-top': '-200px',
            duration: 300,
            complete: onComplete
        });
    } else {
        $(context.dialogElement).show('block');
        if ('function' === typeof onComplete)
            onComplete();
    }
};

var _hideDialog = function(context, onComplete) {
    if (context.animate) {
        $(context.dialogElement).animate({
            'margin-top': '-1000px',
            duration: 300,
            complete: function() {
                $(context.dialogElement).hide();
                if ('function' === typeof onComplete)
                    onComplete();
            }
        });
    } else {
        $(context.dialogElement).hide();
        if ('function' === typeof onComplete)
            onComplete();
    }
};

// Handle the classes property on the dialog, content, and buttons objects
var _addClasses = function(classes, selector) {
    if ('undefined' === typeof classes)
        return;

    if ('string' === typeof classes)
        $(selector).toggleClass(classes);
    else if (Array === classes.constructor)
        for (var klass in classes)
            $(selector).toggleClass(classes[klass]);
};

// Handle the attributes property on the dialog, content and buttons objects
var _addAttributes = function(attributes, selector) {
    if ('undefined' !== typeof attributes)
        for (var k in attributes)
            $(selector).attr(k, attributes[k]);
};

// Clear content from a dialog
var _clearDialog = function(context) {
    // TODO
};

// Check if the dialogElement exists
var _checkDialog = function(context) {
    if (null !== context.dialogElement)
        return context.dialogElement;

    return $(context.selector)[0];
};

// Check if the overlayElement exists, create one if it doesn't
var _createOverlay = function(context) {
    if (null !== context.overlayElement)
        return context.overlayElement;

    var e = $(context.overlay)[0];
    if ('undefined' !== typeof e)
        return e;

    // Assume a class selector for overlay
    var o = context.overlay;
    if ('undefined' === typeof o)
        o = '.overlay';
    else if (o[0] != '#' && o[0] != '.')
        o = '.' + o;

    var html ='<div ';
    if (o[0] == '#')
        html += 'id="' + o.substring(1) + '"';
    else
        html += 'class="' + o.substring(1) + '"';
    html += '></div>';
    global.document.body.insertAdjacentHTML("beforeend", html);

    context.overlay = o;
    return $(o)[0];
};

// Retreive a dialog from a URL (DOM Element)
var _fetchDialog = function(url, success, err) {
    if (null === url || url.length === 0) {
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
            }
        }
    };
    xhr.open('GET', url, true);
    xhr.send('');
};


// Extend implemenation
var _extend = function(target, source) {
    target = target || {};
    for (var prop in source) {
        if ('object' === typeof source[prop].constructor)
            target[prop] = _extend(target[prop], source[prop]);
        else
            target[prop] = source[prop];
    }
    return target;
};

// Generate a small HTML snippet for a button
var _generateButtonHtml = function(selector, button) {
    var tag = ('undefined' === typeof button.tag) ? 'button' : button.tag;
    var html = '<' + tag;

    // Assume class selector
    if (selector[0] != '#' && selector[0] != '.')
        selector = '.' + selector;

    if (selector[0] == '#')
        html += ' id="' + selector.substring(1) + '"></' + tag + '>';
    else
        html += ' class="' + selector.substring(1) + '"></' + tag + '>';
    return html;
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
