'use strict';

var PushKaSw = function()
{
    var sw = this;

    this.mode       = 'debug';
    this.version    = 3;
    this.apiBaseUrl = self.location.host === 'localhost' || self.location.host === '127.0.0.1' ? 'http://'+self.location.host+'/api/' : 'https://burningpush.info/api/';

    this.storage        = (new IndexDbStorage('push-ka', 'params'));
    this.defaultMessage = {
        title : 'You have new message',
        body  : 'You received new message.',
        //icon  : '/media/icon-192x192.png',
        //icon  : 'https://developer.mozilla.org/static/img/web-docs-sprite.22a6a085cf14.svg',
        tag   : 'push-ka-default-tag',
        data  : []
    };

    this.init = function (){
        self.addEventListener('push',                   onPush);
        self.addEventListener('install',                onInstall);
        self.addEventListener('activate',               onActivate);
        self.addEventListener('notificationclick',      onClickMessage);
        self.addEventListener('pushsubscriptionchange', onSubsChanged);

        return sw;
    };

    function onInstall(event) {
        log('on install event');
        event.waitUntil(self.skipWaiting());
    }

    function onActivate(event) {
        log('on activate event');
        event.waitUntil(
            self.clients.claim()
        );
    }

    function onPush(event) {
        log('Received a push message');

        event.waitUntil(
            sw.storage.get('sid').then(function(subsId)
            {
                sw.storage.get('srv').then(function(srvId)
                {
                    self.registration.pushManager.getSubscription().then(function(subscription)
                    {
                        fetchAndShowMessage(subsId, subscription.endpoint, srvId);
                    });
                })
                .catch(function(e){ // write error & send request for message
                    error(e);
                    self.registration.pushManager.getSubscription().then(function(subscription)
                    {
                        fetchAndShowMessage(subsId, subscription.endpoint, null);
                    });
                })
            })
            .catch(function(e){error(e);})
        );
    }

    function onClickMessage(event)
    {
        log('On notification click: ', event);

        event.notification.close(); // Android doesn’t close the notification when you click on it

        event.waitUntil(
            clients.matchAll({type: 'window'}).then(function(clientList)
            {
                if(event.action)
                {
                    if(clients.openWindow && event.notification.data.actions[event.action] && event.notification.data.actions[event.action].url)
                        return clients.openWindow(event.notification.data.actions[event.action].url);
                }

                if(clients.openWindow && event.notification.data.url)
                    return clients.openWindow(event.notification.data.url);

                for (var i = 0; i < clientList.length; i++)
                {
                    var client = clientList[i];
                    if (client.url === '/' && 'focus' in client)
                        return client.focus();
                }
            })
        );
    }

    function showMessage(data)
    {
        if( typeof data != "undefined" )
        {
            data.title = typeof data.title != "undefined" ? data.title : sw.defaultMessage.title;
            data.data  = typeof data.data != "undefined"  ? data.data  : sw.defaultMessage.data;
            data.tag   = typeof data.tag != "undefined"   ? data.tag   : sw.defaultMessage.tag;
            //data.icon = typeof data.icon != "undefined" ? data.icon : sw.defaultMessage.icon;
        }
        else
            data = sw.defaultMessage;

        if( !('actions' in Notification.prototype) )
            delete data.actions;

        self.registration.showNotification(data.title, data);

        return true;
    }

    function fetchAndShowMessage(subsId, subsEndpoint, serverId)
    {
        var endpoint = subsId ? null : (subsEndpoint ? subsEndpoint : null);
        var url = sw.apiBaseUrl+'subscription/message?subsId='+encodeURIComponent(subsId)+(endpoint ? '&subsEndpoint='+encodeURIComponent(endpoint) : '')+(serverId ? '&srv='+encodeURIComponent(serverId) : '');

        fetch(url, {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            },
            credential: "include"
        })
        .then(function(response) {return response.json();})
        .then(function(data)     {
            if( data.notify )
            {
                showMessage(data.notify);
                if(data.pixels && data.pixels.length > 0)
                {
                    data.pixels.forEach(function(pixel) {
                        fetch(pixel, {
                            credentials: 'include',
                            method: 'GET',
                            mode: 'no-cors'
                        });
                    });
                }
            }
            else
                log("No content for subsId:"+subsId);
        })
        .catch(function(e) {error(e);});
    }

    /**
     * Event is fired when subscription expires. Subscribe again and register the new subscription in the server by sending a POST request with endpoint.
     * Real world application would probably use also user identification.
     */
    function onSubsChanged (event)
    {
        console.log("Push Subscription Change");

        event.waitUntil(
            self.registration.pushManager.getSubscription()
            .then(function(subscription)
            {
                sw.storage.get('uid').then(function(clientId)
                {
                    sw.storage.get('sid').then(function(subsId)
                    {
                        return fetch(sw.apiBaseUrl+'subscription/change', {
                            method: 'post',
                            headers: {
                                'Content-type': 'application/json'
                            },
                            body: JSON.stringify({
                                subsId   : subsId,
                                clientId : clientId,
                                subs     : subscription,
                                event    : event
                            })
                        });
                    })
                    .catch(function(e){error(e);});
                })
                .catch(function(e){error(e);});
            })
            .catch(function(e){error(e);})
        );
    }

    function isDebugMode()
    {
        return sw.mode === 'debug';
    }

    function error(msg)
    {
        console.error('[SW] '+msg);
    }

    function log(msg)
    {
        if( isDebugMode() )
            console.log('[SW] '+msg);
    }

    function IndexDbStorage(dbName, store)
    {
        var db        = null;
        var storeName = null;
        var obj       = this;

        if( store )
            storeName = store;

        this.init = init;

        function init(store)
        {
            var initId = Math.random();
            //log('init store:'+store+'; db:'+dbName+'; id:'+initId);
            var promise = new Promise(function(resolve, reject) {

                if( db && store == storeName )
                {
                    //log('resolve old connection store:'+store+'; db:'+dbName+'; id:'+initId);
                    resolve(db);
                    return;
                }

                var handle = indexedDB.open(dbName);
                handle.onupgradeneeded = function(event) {
                    //log('start onupgradeneeded'+'; id:'+initId);

                    db = handle.result;

                    if (event.oldVersion < 1)
                    {
                        var st = db.createObjectStore(storeName, {keyPath: "key"});

                        var transaction = event.target.transaction;// the important part
                        var addRequest = transaction.objectStore(storeName).add({key:"version", value: event.newVersion});
                        addRequest.onsuccess = function()
                        {
                            log('Success upgrade to version:'+event.newVersion+'; id:'+initId);
                        };
                        //log('create store:'+storeName+'; id:'+initId);
                    }

                    //log('end onupgradeneeded'+'; id:'+initId);
                };

                handle.onerror   = function(e){ reject(new Error("Error on open Db ("+dbName+"):"+e+'; id:'+initId)); };
                handle.onsuccess = function() {
                    db = handle.result; // db.version will be 3.
                    log('success init db store:'+dbName+'; id:'+initId);
                    resolve(db);
                };
            });

            return promise;
        };

        this.get = function(key)
        {
            var promise = new Promise(function(resolve, reject)
            {
                //log('start get '+key+': before init');
                obj.init(storeName).then(function(database){

                    //log('start get '+key+': after init');
                    //database.onversionchange = function(e){ console.log(e); };
                    var transact = database.transaction(storeName, "readonly");
                    var store    = transact.objectStore(storeName);

                    var data = store.get(key);
                    data.onsuccess = function(e) {
                        //log('success get '+key+': '+(e.target.result ? e.target.result.value : 'null'));
                        resolve(e.target.result ? e.target.result.value : null);
                    };
                    data.onerror = function(e) {
                        reject(new Error("Error on get key:"+key+" ("+storeName+"):"+e));
                    };
                }).catch(function(error){reject(error)});
            });

            return promise;
        };

        this.set = function(key, value)
        {
            var promise = new Promise(function(resolve, reject)
            {
                obj.init(storeName).then(function(db){
                    //log('start set '+key+': after init');
                    var transact = db.transaction(storeName, "readwrite");
                    var store    = transact.objectStore(storeName);

                    store.put({key:key, value: value}).onsuccess = function(e) {
                        resolve(e.target.result);
                    };
                }).catch(function(error){reject(error)});
            });

            return promise;
        };

        this.del = function(key)
        {
            var promise = new Promise(function(resolve, reject)
            {
                obj.init(storeName).then(function(db){
                    var transact = db.transaction(storeName, "readwrite");
                    var store    = transact.objectStore(storeName);

                    store.delete(key).onsuccess = function(e) {
                        resolve(true);
                    };
                }).catch(function(error){reject(error)});
            });

            return promise;
        };

        this.store = function(store)
        {
            storeName = store;
        };
    }
};

var objPushKaSw = (new PushKaSw).init();






