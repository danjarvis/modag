!function ($) {
  var m = require('modag');

  $.ender({
    modag: m
  });

  $.ender({
    modag: function(opts) {
      opts._dialogElement = this;
      return modag(opts);
    }
  }, true);
}(ender);
