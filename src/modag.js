/**
 * modag.js
 * (c) Dan Jarvis 2012 - License MIT
 */
!function (name, context, definition) {
  if ('undefined' !== typeof module && module.exports) module.exports = definition()
  else if ('function' === typeof define && define.amd) define(definition)
  else context[name] = definition()
}('modag', this, function() {

  function _async(fn) {
    setTimeout(fn, 20);
  }

  function _log(msg) {
    if (window.console && console.log)
      console.log(msg);
  }

  function _extend(target, source) {
    var prop;
    target = target || {};
    for (prop in source) {
      if ('object' === typeof source[prop].constructor)
        target[prop] = this._extend(target[prop], source[prop]);
      else
        target[prop] = source[prop];
    }
    return target;
  }

  function _addClasses(classes, selector) {
    if ('undefined' === typeof classes)
      return;

    if ('string' === typeof classes)
      $(selector).toggleClass(classes);
    else if (Array === classes.constructor)
      for (var klass in classes)
        $(selector).toggleClass(classes[klass]);
  }

  function _addAttributes(attributes, selector) {
    if ('undefined' !== typeof attributes)
      for (var k in attributes)
        $(selector).attr(k, attributes[k]);
  }

  function _addEvents(events, selector, context) {
    if ('undefined' !== typeof events) {
      for (var evt in events)
        $(selector).on(evt, events[evt], context);
    }
  }

  // Check if the overlayElement exists, create one if it doesn't
  function _createOverlay(mo) {
    var e, html, o = mo.overlay;

    if ('undefined' !== typeof mo._overlayElement)
      return mo._overlayElement;

    // Assume a class selector for overlay
    if ('undefined' === typeof o)
      o = '.overlay';
    else if (o[0] != '#' && o[0] != '.')
      o = '.' + o;

    e = $(o)[0];
    if ('undefined' !== typeof e)
      return e;

    html ='<div ';
    if (o[0] == '#')
      html += 'id="' + o.substring(1) + '"';
    else
      html += 'class="' + o.substring(1) + '"';
    html += '></div>';
    $('body').append(html);

    mo.overlay = o;
    return $(o)[0];
  }

  // Check if the dialogElement exists
  function _checkDialog(mo) {
    if ('undefined' !== typeof mo._dialogElement)
      return mo._dialogElement;
    return $(mo.selector)[0];
  }

  // Retreive a dialog from a URL
  function _fetchDialog(url, onSuccess, onError) {
    if ('undefined' === typeof url || url.length === 0) {
      _log('_fetchDialog called without a URL!');
      return;
    }

    $.ajax({
      url: url,
      method: 'get',
      success: function(response) {
        $('body').append(response);
        if ('function' === typeof onSuccess)
          onSuccess($('body').children().last());
      },
      error: function() {
        if ('function' === typeof onError)
          onError();
      }
    });
  }

  /**
   * Modag Implementation
   */

  function Modag(opts) {
    var context = _extend(this, opts || {});
    if (context.preload && 'undefined' !== typeof context.url)
      context._preloadDialog(context);

    if (context.trigger.selector && context.trigger.event) {
      $(context.trigger.selector).on(context.trigger.event, function (e, dialog) {
        dialog.show();
      }, context);
    }
  }

  Modag.prototype = {
    selector: undefined,
    classes: [],
    attributes: {},
    preload: true,
    animate: false,
    modal: true,
    hideOnOverlayClick: true,
    overlay: undefined,
    url: undefined,
    shown: undefined,
    hidden: undefined,
    trigger: {},
    content: {},
    _loaded: false,
    _overlayElement: undefined,
    _dialogElement: undefined,

    // Show a dialog
    show: function (opts) {
      var context = _extend(this, opts || {});
      context._dialogElement = _checkDialog(context);

      // Obtain a DOM Element for the dialog
      if ('undefined' === typeof context._dialogElement) {
        _fetchDialog(context.url, function(e) {
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

    set: function(key, o) {
      if ('object' !== typeof o)
        return;

      if ('undefined' === typeof this.content[key])
        this.content[key] = o;
      else
        this.content[key] = _extend(this.content[key], o);
      this._set(key);
    },

    // Destroy a dialog
    destroy: function() {
      var c, evt;

      if (this.trigger.selector && this.trigger.event)
        $(this.trigger.selector).off(this.trigger.event);

      if ('object' === typeof this.content) {
        for (c in this.content) {
          if ('object' === typeof c.events)
            for (evt in c.events)
              $(c.selector, this._dialogElement).off(evt);
        }
      }

      if (this.modal) {
        this._hideOverlay(this, function() {
          $(this._overlayElement).off('click');
        });
      }
      $(this._dialogElement).remove();
    },

    _set: function(key) {
      var selector
        , item = this.content[key]

      if ('undefined' === typeof item) {
        _log('_set() encountered an invalid key: ' + key);
        return;
      }

      selector = $(key, this._dialogElement);
      if ('undefined' === typeof selector) {
        _log('_set() could not find an element');
        return;
      }

      if (item.text)
        $(selector).text(item.text);
      if (item.html)
        $(selector).html(item.html);

      _addClasses(item.classes, selector);
      _addAttributes(item.attributes, selector);
      _addEvents(item.events, selector, this);
    },

    // Pre load a dialog
    _preloadDialog: function() {
      var context = this;
      _async(function() {
        context._dialogElement = _checkDialog(context);
        if ('undefined' === typeof context._dialogElement) {
          _fetchDialog(context.url,
            function (e) {
              context._loaded = true;
              context._dialogElement = e;
              context._fillDialog();
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
      _addClasses(this.classes, this._dialogElement);

      // Content
      if ('object' === typeof this.content)
        for (c in this.content)
          this._set(c);

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
      if ('undefined' === typeof this._overlayElement)
        this._overlayElement = _createOverlay(this);

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
    }
  };

  function modag(opts) {
    return new Modag(opts);
  }

  return modag;
});

