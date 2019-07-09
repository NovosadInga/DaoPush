"use strict";

//require ../../node_modules/object-fit-images/dist/ofi.min.js
//require lib/jquery-3.3.1.min.js
$(function () {
  var windowWidth = window.innerWidth;
  var windowHeigth = window.innerHeight;
  var mobileWidth = 991;
  var wdw = $(window);
  var scrolledTop = wdw.scrollTop();
  var isDesktop = checkIsDesktop();
  var menuHeight = isDesktop ? 66 : 44;

  function checkIsDesktop() {
    return windowWidth > mobileWidth ? true : false;
  }

  wdw.scroll(function () {
    scrolledTop = wdw.scrollTop();
  });

  wdw.resize(function () {
    windowWidth = window.innerWidth;
    windowHeigth = window.innerHeight;
    isDesktop = checkIsDesktop();
    menuHeight = isDesktop ? 66 : 44;
    scrolledTop = wdw.scrollTop();
  });

  function Menu() {
    this.desktopMenu = $(".desktop-nav");
    this.mobileMenu = $(".mobile-nav");
    this.menuItems = $(".js-menu");
    this.mobileBtn = $(".js-mobile-btn");

    if (this.desktopMenu.length && this.mobileMenu.length) this._init();

    return this;
  }

  Menu.prototype._init = function () {
    this.stateMenu();
    this.setEvents();
  };

  Menu.prototype.setEvents = function () {
    var _this = this;
    wdw.scroll(function () {
      _this.stateMenu();
    });
    this.menuItems.on("click touch", function (event) {
      if (this.hash !== "") {
        event.preventDefault();
        var hash = this.hash;
        $("body").removeClass("nav-open");
        $("html, body").stop().animate({
          scrollTop: $(hash).offset().top - menuHeight
        }, 1000, function () {
          history.pushState(null, null, hash);
        });
      }
    });
    this.mobileBtn.on("click touch", function (event) {
      event.preventDefault();
      $("body").toggleClass("nav-open");
    });
  };

  Menu.prototype.stateMenu = function () {
    if (scrolledTop > 0) // если на мобайле не нужно фиксед -> добавить в проверку isDesktop
      this.desktopMenu.addClass("fixed");else this.desktopMenu.removeClass("fixed");
  };

  function Sliders() {
    this.sliderHeader = $('.js-slick-header');
    this.sliderNotebook = $(".js-notebook-slider");
    this.slidersOffer = $(".js-slider-ofr");
    this.slidersOfferEnabled = false;

    if (this.sliderHeader.length) this.sliderHeader.slick({
      autoplay: true,
      dots: true,
      speed: 500
    });

    if (this.sliderNotebook.length) this.sliderNotebook.slick({
      accessibility: false,
      autoplay: true,
      draggable: false,
      swipe: false,
      touchMove: false,
      pauseOnFocus: false,
      pauseOnHover: false,
      arrows: false,
      speed: 500,
      fade: true,
      cssEase: 'linear'
    });

    if (this.slidersOffer && !isDesktop && !this.slidersOfferEnabled) this.startOfferSlider();

    this._setEvents();

    return this;
  }

  Sliders.prototype._setEvents = function () {
    var _this = this;
    wdw.resize(function () {
      if (isDesktop && _this.slidersOfferEnabled && _this.slidersOffer) _this.stopOfferSlider();
      if (!isDesktop && !_this.slidersOfferEnabled && _this.slidersOffer) _this.startOfferSlider();
    });
  };

  Sliders.prototype.startOfferSlider = function () {
    this.slidersOffer.each(function (index, element) {
      $(element).slick({
        autoplay: true,
        dots: true,
        speed: 500
      });
    });
    this.slidersOfferEnabled = true;
  };

  Sliders.prototype.stopOfferSlider = function () {
    this.slidersOffer.each(function (index, element) {
      $(element).slick('unslick');
    });
    this.slidersOfferEnabled = false;
  };

  function Above(element) {
    this.item = $(element);
    this.val = this.item.find(".js-above-val");
    this.back = this.item.find(".js-above-before-bg");
    this.isEnded = false;
    this.divideStep = 24;
    this.divideStepSpeed = 40; //ms
    this.fadeSpeed = 2000; //ms

    this._init();

    return this;
  }

  Above.prototype._init = function () {
    if (this.val && this.back) {
      var blockCenter = this.item.offset().top + this.item.innerHeight() / 2 - 70;
      var _this = this;
      this.resetValue();
      if (blockCenter > scrolledTop + menuHeight && blockCenter < scrolledTop + windowHeigth - menuHeight) {
        _this.start();
      } else {
        wdw.scroll(function () {
          if (_this.isEnded) return false;
          if (blockCenter > scrolledTop + menuHeight && blockCenter < scrolledTop + windowHeigth - menuHeight) _this.start();
        });
      }
    }
  };

  Above.prototype.resetValue = function () {
    this.val.attr("data-max", this.val.text());
    this.val.text("0");
  };

  Above.prototype.countStart = function () {
    var _this2 = this;

    var max = parseInt(this.val.attr("data-max").replace(/\s/g, ''));
    var k = max / this.divideStep;
    var startValue = k;
    var timerId = setInterval(function () {
      var str = '';
      if (Math.round(startValue) <= max) {
        str += Math.round(startValue);
        switch (str.length) {
          case 4:
            str = str[0] + ' ' + str.slice(1);
            break;
          case 6:
            str = str.slice(0, 3) + ' ' + str.slice(3);
            break;
          case 7:
            str = str[0] + ' ' + str.slice(1, 4) + ' ' + str.slice(4);
            break;
        }
        _this2.val.text(str);
        startValue += k;
      } else {
        clearInterval(timerId);
      }
    }, this.divideStepSpeed);
    this.isEnded = true;
  };

  Above.prototype.start = function () {
    var _this3 = this;

    this.back.fadeIn(this.fadeSpeed);
    setTimeout(function () {
      _this3.countStart();
    }, this.fadeSpeed / 2);
  };

  function Toggle() {
    this.checkbox = $("#toggle");
    this.registerCheckbox = $("#toggle-register");
    this.label = $("label[for=\"" + this.checkbox.attr("id") + "\"]");
    this.webmastersContent = $("#webmasters");
    this.prsContent = $("#prs");
    this.registerInput = $("#register-role");

    if (this.checkbox.length && this.webmastersContent.length && this.prsContent.length) this._setEvents();
    if (this.registerCheckbox.length && this.registerInput.length) this.registerRole();

    return this;
  }

  Toggle.prototype._setEvents = function () {
    var _this = this;
    this.checkbox.change(function () {
      if ($(this).prop("checked")) {
        _this.webmastersContent.removeClass("active");
        _this.prsContent.addClass("active");
      } else {
        _this.prsContent.removeClass("active");
        _this.webmastersContent.addClass("active");
      }
    });
    this.label.mousedown(function () {
      // сброс выделения текста при кликах на тоггл
      event.stopPropagation();
      event.preventDefault();
      return false;
    });
  };

  Toggle.prototype.registerRole = function () {
    var _this = this;
    this.registerCheckbox.change(function () {
      $(this).prop("checked") ? _this.registerInput.val("pr") : _this.registerInput.val("web");
      console.log(_this.registerInput.val());
    });
  };

  function Notify() {
    this.block = $(".js-notify-block");
    this.item = $(".js-notify-item");
    this.isEnded = false;

    if (this.block.length && this.item.length) this._init();

    return this;
  }

  Notify.prototype._init = function () {
    if (this.block.offset().top > scrolledTop && this.block.offset().top + this.block.innerHeight() < scrolledTop + windowHeigth) {
      this.item.addClass("animate");
    } else {
      this.setEvents();
    }
  };

  Notify.prototype.setEvents = function () {
    var _this = this;
    wdw.scroll(function () {
      if (_this.isEnded) return;
      if (_this.block.offset().top > scrolledTop && _this.block.offset().top + _this.block.innerHeight() < scrolledTop + windowHeigth) {
        _this.item.addClass("animate");
        _this.isEnded = true;
      }
    });
  };

  function AnimationMobile() {
    this.items = $(".js-browser");
    this.animationTime = 2000;
    this.timerId = null;

    if (this.items.length) this._init();

    return this;
  }

  AnimationMobile.prototype._init = function () {
    if (!isDesktop) this.timerId = this.startAnimate();else this.setEvents();
  };

  AnimationMobile.prototype.setEvents = function () {
    var _this = this;
    wdw.resize(function () {
      if (isDesktop && _this.timerId) {
        _this.timerId = null;
        _this.resetAnimate();
      }
      if (!isDesktop && !_this.timerId) _this.timerId = this.startAnimate();
    });
  };

  AnimationMobile.prototype.resetAnimate = function () {
    this.items.each(function (index, element) {
      $(element).removeClass("active");
    });
  };

  AnimationMobile.prototype.startAnimate = function () {
    var _this = this;
    var itemsCount = this.items.length;
    var itemCurrent = 0;
    var itemPrev = itemCurrent - 1;
    var timerId = setTimeout(function run() {
      itemPrev = itemCurrent - 1 < 0 ? itemsCount - 1 : itemCurrent - 1;
      $(_this.items[itemPrev]).removeClass("active");
      $(_this.items[itemCurrent]).addClass("active");
      itemCurrent = itemCurrent < itemsCount - 1 ? ++itemCurrent : 0;
      setTimeout(run, _this.animationTime);
    }, _this.animationTime);

    return timerId;
  };

  new Menu();
  new Sliders();
  $(".js-above-item").each(function (index, element) {
    new Above(element);
  });
  new Toggle();
  new Notify();
  new AnimationMobile();
});