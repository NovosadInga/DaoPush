window.onload = function() {
  var acceptCookieBtn = document.getElementById('accept-cookie'),
      cookieNotice = document.getElementsByClassName('modal__cookies')[0],
      accept = "modal__cookies-accepted";

  checkCookieAccept(accept, cookieNotice);

  acceptCookieBtn.onclick = function(evt) {
    evt.preventDefault();

    //expires: 45 = 45 days
    setCookie(accept, "true", {expires: 45});
    closeCookieNotice(cookieNotice);
  }
}

function checkCookieAccept(name, block) {
  if(getCookie(name) == "true") {
    return;
  } else {
    openCookieNotice(block);
  }
}

function openCookieNotice(block) {
  block.classList.add("modal__cookies_active");
}

function closeCookieNotice(block) {
  block.style.display = "none";
}

function getCookie(name) {
  var matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setCookie(name, value, options) {
  options = options || {};

  var expires = options.expires;

  if (typeof expires == "number" && expires) {
    var d = new Date();
    console.log(d.getTime());
    d.setTime(d.getTime() + expires * 24 * 60 * 60 * 1000);
    expires = options.expires = d;
  }
  if (expires && expires.toUTCString) {
    options.expires = expires.toUTCString();
  }

  value = encodeURIComponent(value);

  var updatedCookie = name + "=" + value;

  for (var propName in options) {
    updatedCookie += "; " + propName;
    var propValue = options[propName];
    if (propValue !== true) {
      updatedCookie += "=" + propValue;
    }
  }

  document.cookie = updatedCookie;
}

function deleteCookie(name) {
  setCookie(name, "", {
    expires: -1
  })
}