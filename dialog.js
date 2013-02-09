/*!
 * dialog.js
 * (c) Dan Jarvis 2012 - License MIT
 */
;(function (global, undefined) {
  'use strict';
function Dialog(opts) {
  var context = _extend(this, opts || {});
  if (context.preload && context.url)
    context._preloadDialog(context);

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
  overlay: null,
  url: null,
  shown: undefined,
  hidden: undefined,
  trigger: {},
  content: {},
  buttons: {},
  _loaded: false,
  _overlayElement: null,
  _dialogElement: null,

  // Show a dialog
  show: function (opts) {
    var context = _extend(this, opts || {});
    context._dialogElement =context._checkDialog(context);

    // Obtain a DOM Element for the dialog
    if ('undefined' === typeof context._dialogElement) {
      context._fetchDialog(context.url, function(e) {
        context._dialogElement = e;
        context._fillDialog();
      });
    } else {
      if (!context._loaded)
        context._fillDialog(true);
      else
        context._show();
    }
  },

  // Hide a dialog
  hide: function() {
    this._hide();
  },

  // Lookup an existing content item and fill the dialog accordingly
  // <key> should be a key in this.content, represents the selector
  // <selector> if specified, use this is the selector instead of key
  setContent: function(key, isButton, selector) {
    var contentItem = isButton ? this.buttons[key] : this.content[key]
      , contentSelector;

    if ('undefined' === typeof contentItem) {
      _log('setContentItem encountered an invalid key: ' + key);
      return;
    }

    if ('undefined' === typeof selector)
      contentSelector = $(key, this._dialogElement);
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

    this._addClasses(contentItem.classes, contentSelector);
    this._addAttributes(contentItem.attributes, contentSelector);
  },

  // Lookup an existing button item and fill the dialog accordingly
  // <key> should be a key in this.buttons, represents the selector
  setButton: function(key) {
    var buttonItem = this.buttons[key]
      , buttonSelector = $(key, this._dialogElement)
      , html = _generateButtonHtml(key, buttonItem)
      , evt;

    if ('undefined' === typeof buttonItem) {
      _log('setButtonItem encountered an invalid key: ' + key);
      return;
    }

    // If this button does not exist, add it (if specified)
    if (('undefined' === typeof buttonSelector || buttonSelector.length < 1) && buttonItem.generate) {
      if ('undefined' === typeof buttonItem.container)
        $(this._dialogElement).append(html);
      else
        $(buttonItem.container, this._dialogElement).append(html);

      buttonSelector = $(key, this._dialogElement);
    }

    // Buttons can also have the same properties as content items.
    this.setContent(key, true, buttonSelector);

    // Hook up events
    if ('object' === typeof buttonItem.events) {
      for (evt in buttonItem.events)
        $(buttonSelector).on(evt, buttonItem.events[evt], this);
    }
  },

  // Add or update this.content and change the dialog
  updateContent: function(key, content) {
    if ('object' !== typeof content)
      return;

    if ('undefined' === typeof this.content[key])
      this.content[key] = content;
    else
      this.content[key] = _extend(this.content[key], content);
    this.setContent(key);
  },

  // Destroy a dialog.
  //  - remove any events attached to elements we know about
  //  - remove the dialog from the DOM
  destroy: function() {
    var b, evt;
    if (this.trigger.selector && this.trigger.event)
      $(this.trigger.selector).off(this.trigger.event);

    if ('object' === typeof this.buttons) {
      for (b in this.buttons) {
        if ('object' === typeof b.events)
          for (evt in b.events)
            $(b.selector, this._dialogElement).off(evt);
      }
    }

    if (this.modal) {
      this._hideOverlay(this, function() {
        $(this._overlayElement).off('click');
      });
    }
    $(this._dialogElement).remove();
  },

  // Pre load a dialog
  _preloadDialog: function() {
    var context = this;
    _async(function() {
      context._dialogElement = context._checkDialog(context);
      if ('undefined' === typeof context._dialogElement) {
        context._fetchDialog(context.url,
          function (e) {
            context._loaded = true;
            context._dialogElement = e;
            context._fillDialog(context);
          },
          function () {
            _log('unable to fetch dialog from the server!');
          });
      }
    });
  },

  // Fill a dialog with content
  _fillDialog: function(show) {
    var c;

    // Add additional root classes if specified
    this._addClasses(this.classes, this._dialogElement);

    // Content
    if ('object' === typeof this.content)
      for (c in this.content)
        this.setContent(c, false);

    if (show)
      this._show();
  },

  _show: function() {
    var context = this;
    if (this.modal) {
      this._showOverlay(function() {
        context._showDialog(function() {
          if ('function' === typeof context.shown) {
            context.shown(context);
          }
        });
      });
    } else {
      this._showDialog(function() {
        if ('function' === typeof context.shown)
          context.shown(context);
      });
    }
  },

  _hide: function() {
    var context = this;
    if (this.modal) {
      this._hideDialog(function() {
        context._hideOverlay(function() {
          if ('function' === typeof context.hidden)
            context.hidden(context);
        });
      });
    } else {
      this._hideDialog(function() {
        if ('function' === typeof context.hidden)
          context.hidden(context);
      });
    }
  },

  _showOverlay: function(onComplete) {
    var context = this;
    if (null === this._overlayElement)
      this._overlayElement = this._createOverlay(context);

    if (this.hideOnOverlayClick) {
      $(this._overlayElement).on('click', function() {
        context.hide();
      });
    }

    if (this.animate) {
      $(this._overlayElement).css({
        display: 'block',
        opacity: 0
      })
      .animate({
        opacity: 0.8,
        duration: 250,
        complete: onComplete
      });
    } else {
      $(this._overlayElement).show('block');
      if ('function' === typeof onComplete)
        onComplete();
    }
  },

  _hideOverlay: function(onComplete) {
    var context = this;
    if (this.hideOnOverlayClick)
      $(this._overlayElement).on('click', null);

    if (this.animate) {
      $(this._overlayElement).animate({
        display: 'none',
        opacity: 0,
        duration: 250,
        complete: function() {
          $(context._overlayElement).hide();
          if ('function' === typeof onComplete)
            onComplete();
        }
      });
    } else {
      $(this._overlayElement).hide();
      if ('function' === typeof onComplete)
        onComplete();
    }
  },

  _showDialog: function(onComplete) {
    if (this.animate) {
      $(this._dialogElement).css({
        display: 'block',
        'margin-top': '-1000px'
      })
      .animate({
        'margin-top': '-200px',
        duration: 300,
        complete: onComplete
      });
    } else {
      $(this._dialogElement).show('block');
      if ('function' === typeof onComplete)
        onComplete();
    }
  },

  _hideDialog: function(onComplete) {
    var context = this;
    if (this.animate) {
      $(this._dialogElement).animate({
        'margin-top': '-1000px',
        duration: 300,
        complete: function() {
          $(context._dialogElement).hide();
          if ('function' === typeof onComplete)
            onComplete();
        }
      });
    } else {
      $(this._dialogElement).hide();
      if ('function' === typeof onComplete)
        onComplete();
    }
  },

  _addClasses: function(classes, selector) {
    if ('undefined' === typeof classes)
      return;

    if ('string' === typeof classes)
      $(selector).toggleClass(classes);
    else if (Array === classes.constructor)
      for (var klass in classes)
        $(selector).toggleClass(classes[klass]);
  },

  _addAttributes: function(attributes, selector) {
    if ('undefined' !== typeof attributes)
      for (var k in attributes)
        $(selector).attr(k, attributes[k]);
  },

  // Check if the dialogElement exists
  _checkDialog: function() {
    if (null !== this._dialogElement)
      return this._dialogElement;
    return $(this.selector)[0];
  },

  // Check if the overlayElement exists, create one if it doesn't
  _createOverlay: function() {
    var e, html, o = this.overlay

    if (null !== this._overlayElement)
      return this._overlayElement;

    e = $(this.overlay)[0];
    if ('undefined' !== typeof e)
      return e;

    // Assume a class selector for overlay
    if ('undefined' === typeof o)
      o = '.overlay';
    else if (o[0] != '#' && o[0] != '.')
      o = '.' + o;

    html ='<div ';
    if (o[0] == '#')
      html += 'id="' + o.substring(1) + '"';
    else
      html += 'class="' + o.substring(1) + '"';
    html += '></div>';
    global.document.body.insertAdjacentHTML('beforeend', html);

    this.overlay = o;
    return $(o)[0];
  },

  // Retreive a dialog from a URL (DOM Element)
  _fetchDialog: function(url, success, err) {
    var xhr;

    if (null === url || url.length === 0) {
      _log('_fetchDialog called without a URL!');
      return;
    }

    xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (this.readyState == 4) {
        if (this.status == 200) {
          // Inject the dialog
          global.document.body.insertAdjacentHTML('beforeend', this.responseText);
          if ('function' === typeof success) {
            success(global.document.body.children[(global.document.body.children.length - 1)]);
          }
        } else {
          if ('function' === typeof err)
            err();
        }
      }
    };
    xhr.open('GET', url, true);
    xhr.send('');
  }
};

var _async = function(fn) { setTimeout(fn, 20); }
  , _log = function(msg) { if (window.console && console.log) { console.log(msg); } }
  , _extend = function(target, source) {
    var prop;
    target = target || {};
    for (prop in source) {
      if ('object' === typeof source[prop].constructor)
        target[prop] = this._extend(target[prop], source[prop]);
      else
        target[prop] = source[prop];
    }
    return target;
  };

// Expose
if (typeof define === 'function' && define.amd)
  define(function() { return Dialog; });
else
  global.Dialog = Dialog;
})(this);
