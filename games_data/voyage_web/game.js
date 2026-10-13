
var Module;

if (typeof Module === 'undefined') Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function() {
 var loadPackage = function(metadata) {

  var PACKAGE_PATH;
  if (typeof window === 'object') {
    PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/');
  } else if (typeof location !== 'undefined') {
      // worker
      PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf('/')) + '/');
    } else {
      throw 'using preloaded data can only be done on a web page or in a web worker';
    }
    var PACKAGE_NAME = 'game.data';
    var REMOTE_PACKAGE_BASE = 'game.data';
    if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
      Module['locateFile'] = Module['locateFilePackage'];
      Module.printErr('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
    }
    var REMOTE_PACKAGE_NAME = typeof Module['locateFile'] === 'function' ?
    Module['locateFile'](REMOTE_PACKAGE_BASE) :
    ((Module['filePackagePrefixURL'] || '') + REMOTE_PACKAGE_BASE);

    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;

    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil(total * Module.expectedDataFileDownloads/num);
          if (Module['setStatus']) Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...');
        }
      };
      xhr.onerror = function(event) {
        throw new Error("NetworkError for: " + packageName);
      }
      xhr.onload = function(event) {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    };

    function handleError(error) {
      console.error('package error:', error);
    };

    function runWithFS() {

      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
      Module['FS_createPath']('/', 'SUIT', true, true);
      Module['FS_createPath']('/', 'assets', true, true);
      Module['FS_createPath']('/', 'game', true, true);
      Module['FS_createPath']('/game', 'fishing', true, true);
      Module['FS_createPath']('/', 'mods', true, true);
      Module['FS_createPath']('/', 'shop', true, true);
      Module['FS_createPath']('/shop', 'ui', true, true);

      function DataRequest(start, end, crunched, audio) {
        this.start = start;
        this.end = end;
        this.crunched = crunched;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function(mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module['addRunDependency']('fp ' + this.name);
        },
        send: function() {},
        onload: function() {
          var byteArray = this.byteArray.subarray(this.start, this.end);

          this.finish(byteArray);

        },
        finish: function(byteArray) {
          var that = this;

        Module['FS_createDataFile'](this.name, null, byteArray, true, true, true); // canOwn this data in the filesystem, it is a slide into the heap that will never change
        Module['removeRunDependency']('fp ' + that.name);

        this.requests[this.name] = null;
      }
    };

    var files = metadata.files;
    for (i = 0; i < files.length; ++i) {
      new DataRequest(files[i].start, files[i].end, files[i].crunched, files[i].audio).open('GET', files[i].filename);
    }


    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    var IDB_RO = "readonly";
    var IDB_RW = "readwrite";
    var DB_NAME = "EM_PRELOAD_CACHE";
    var DB_VERSION = 1;
    var METADATA_STORE_NAME = 'METADATA';
    var PACKAGE_STORE_NAME = 'PACKAGES';
    function openDatabase(callback, errback) {
      try {
        var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return errback(e);
      }
      openRequest.onupgradeneeded = function(event) {
        var db = event.target.result;

        if(db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
          db.deleteObjectStore(PACKAGE_STORE_NAME);
        }
        var packages = db.createObjectStore(PACKAGE_STORE_NAME);

        if(db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
        }
        var metadata = db.createObjectStore(METADATA_STORE_NAME);
      };
      openRequest.onsuccess = function(event) {
        var db = event.target.result;
        callback(db);
      };
      openRequest.onerror = function(error) {
        errback(error);
      };
    };

    /* Check if there's a cached package, and if so whether it's the latest available */
    function checkCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
      var metadata = transaction.objectStore(METADATA_STORE_NAME);

      var getRequest = metadata.get("metadata/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        if (!result) {
          return callback(false);
        } else {
          return callback(PACKAGE_UUID === result.uuid);
        }
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function fetchCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
      var packages = transaction.objectStore(PACKAGE_STORE_NAME);

      var getRequest = packages.get("package/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        callback(result);
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function cacheRemotePackage(db, packageName, packageData, packageMeta, callback, errback) {
      var transaction_packages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
      var packages = transaction_packages.objectStore(PACKAGE_STORE_NAME);

      var putPackageRequest = packages.put(packageData, "package/" + packageName);
      putPackageRequest.onsuccess = function(event) {
        var transaction_metadata = db.transaction([METADATA_STORE_NAME], IDB_RW);
        var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
        var putMetadataRequest = metadata.put(packageMeta, "metadata/" + packageName);
        putMetadataRequest.onsuccess = function(event) {
          callback(packageData);
        };
        putMetadataRequest.onerror = function(error) {
          errback(error);
        };
      };
      putPackageRequest.onerror = function(error) {
        errback(error);
      };
    };

    function processPackageData(arrayBuffer) {
      Module.finishedDataFileDownloads++;
      assert(arrayBuffer, 'Loading data file failed.');
      assert(arrayBuffer instanceof ArrayBuffer, 'bad input to processPackageData');
      var byteArray = new Uint8Array(arrayBuffer);
      var curr;

        // copy the entire loaded file into a spot in the heap. Files will refer to slices in that. They cannot be freed though
        // (we may be allocating before malloc is ready, during startup).
        if (Module['SPLIT_MEMORY']) Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');
        var ptr = Module['getMemory'](byteArray.length);
        Module['HEAPU8'].set(byteArray, ptr);
        DataRequest.prototype.byteArray = Module['HEAPU8'].subarray(ptr, ptr+byteArray.length);

        var files = metadata.files;
        for (i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload();
        }
        Module['removeRunDependency']('datafile_game.data');

      };
      Module['addRunDependency']('datafile_game.data');

      if (!Module.preloadResults) Module.preloadResults = {};

      function preloadFallback(error) {
        console.error(error);
        console.error('falling back to default preload behavior');
        fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
      };

      openDatabase(
        function(db) {
          checkCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME,
            function(useCached) {
              Module.preloadResults[PACKAGE_NAME] = {fromCache: useCached};
              if (useCached) {
                console.info('loading ' + PACKAGE_NAME + ' from cache');
                fetchCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME, processPackageData, preloadFallback);
              } else {
                console.info('loading ' + PACKAGE_NAME + ' from remote');
                fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE,
                  function(packageData) {
                    cacheRemotePackage(db, PACKAGE_PATH + PACKAGE_NAME, packageData, {uuid:PACKAGE_UUID}, processPackageData,
                      function(error) {
                        console.error(error);
                        processPackageData(packageData);
                      });
                  }
                  , preloadFallback);
              }
            }
            , preloadFallback);
        }
        , preloadFallback);

      if (Module['setStatus']) Module['setStatus']('Downloading...');

    }
    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

  }
  loadPackage({"package_uuid":"c45fd5fa-7133-410d-b2f0-0f3309db8308","remote_package_size":13043460,"files":[{"filename":"/.DS_Store","crunched":0,"start":0,"end":12292,"audio":false},{"filename":"/.luarc.config","crunched":0,"start":12292,"end":12600,"audio":false},{"filename":"/NotoSans-VariableFont_wdth,wght.ttf","crunched":0,"start":12600,"end":2057148,"audio":false},{"filename":"/SUIT/button.lua","crunched":0,"start":2057148,"end":2057846,"audio":false},{"filename":"/SUIT/checkbox.lua","crunched":0,"start":2057846,"end":2058669,"audio":false},{"filename":"/SUIT/core.lua","crunched":0,"start":2058669,"end":2063198,"audio":false},{"filename":"/SUIT/imagebutton.lua","crunched":0,"start":2063198,"end":2064853,"audio":false},{"filename":"/SUIT/init.lua","crunched":0,"start":2064853,"end":2067564,"audio":false},{"filename":"/SUIT/input.lua","crunched":0,"start":2067564,"end":2071297,"audio":false},{"filename":"/SUIT/label.lua","crunched":0,"start":2071297,"end":2071994,"audio":false},{"filename":"/SUIT/layout.lua","crunched":0,"start":2071994,"end":2080705,"audio":false},{"filename":"/SUIT/license.txt","crunched":0,"start":2080705,"end":2081988,"audio":false},{"filename":"/SUIT/slider.lua","crunched":0,"start":2081988,"end":2083596,"audio":false},{"filename":"/SUIT/suit-0.1-1.rockspec","crunched":0,"start":2083596,"end":2084258,"audio":false},{"filename":"/SUIT/theme.lua","crunched":0,"start":2084258,"end":2088854,"audio":false},{"filename":"/assets/Pirates Red Sprite Sheet.png","crunched":0,"start":2088854,"end":2107544,"audio":false},{"filename":"/assets/Pirates Yellow Sprite Sheet.png","crunched":0,"start":2107544,"end":2126186,"audio":false},{"filename":"/assets/PixelifySans-SemiBold.ttf","crunched":0,"start":2126186,"end":2177286,"audio":false},{"filename":"/assets/boat.png","crunched":0,"start":2177286,"end":2214113,"audio":false},{"filename":"/assets/fish-icon.png","crunched":0,"start":2214113,"end":2215547,"audio":false},{"filename":"/assets/food.avif","crunched":0,"start":2215547,"end":2218944,"audio":false},{"filename":"/assets/glitch.png","crunched":0,"start":2218944,"end":12036735,"audio":false},{"filename":"/assets/house.png","crunched":0,"start":12036735,"end":12039076,"audio":false},{"filename":"/assets/lightning_strike.ogg","crunched":0,"start":12039076,"end":12056349,"audio":true},{"filename":"/assets/rain.ogg","crunched":0,"start":12056349,"end":12077223,"audio":true},{"filename":"/assets/salmon.jpg","crunched":0,"start":12077223,"end":12097755,"audio":false},{"filename":"/assets/shopkeeper.png","crunched":0,"start":12097755,"end":12098466,"audio":false},{"filename":"/assets/shore.png","crunched":0,"start":12098466,"end":12127066,"audio":false},{"filename":"/assets/sleeping.png","crunched":0,"start":12127066,"end":12128046,"audio":false},{"filename":"/assets/vlim-mai-poina-palmtree-compressed.jpg","crunched":0,"start":12128046,"end":12490947,"audio":false},{"filename":"/assets/wave.png","crunched":0,"start":12490947,"end":12493387,"audio":false},{"filename":"/conf.lua","crunched":0,"start":12493387,"end":12495301,"audio":false},{"filename":"/game/action_display.lua","crunched":0,"start":12495301,"end":12510742,"audio":false},{"filename":"/game/alert.lua","crunched":0,"start":12510742,"end":12514438,"audio":false},{"filename":"/game/combat.lua","crunched":0,"start":12514438,"end":12520861,"audio":false},{"filename":"/game/constants.lua","crunched":0,"start":12520861,"end":12528326,"audio":false},{"filename":"/game/crew_management.lua","crunched":0,"start":12528326,"end":12534933,"audio":false},{"filename":"/game/days.lua","crunched":0,"start":12534933,"end":12549906,"audio":false},{"filename":"/game/dialogue.lua","crunched":0,"start":12549906,"end":12552992,"audio":false},{"filename":"/game/draw_steps.lua","crunched":0,"start":12552992,"end":12592645,"audio":false},{"filename":"/game/end_coast.lua","crunched":0,"start":12592645,"end":12598641,"audio":false},{"filename":"/game/ending.lua","crunched":0,"start":12598641,"end":12603318,"audio":false},{"filename":"/game/extra_math.lua","crunched":0,"start":12603318,"end":12605994,"audio":false},{"filename":"/game/fishing/core.lua","crunched":0,"start":12605994,"end":12615481,"audio":false},{"filename":"/game/fishing/minigame.lua","crunched":0,"start":12615481,"end":12638726,"audio":false},{"filename":"/game/fishing/runtime.lua","crunched":0,"start":12638726,"end":12644338,"audio":false},{"filename":"/game/fishing.lua","crunched":0,"start":12644338,"end":12644874,"audio":false},{"filename":"/game/fishing_minigame.lua","crunched":0,"start":12644874,"end":12644938,"audio":false},{"filename":"/game/fishing_runtime.lua","crunched":0,"start":12644938,"end":12645113,"audio":false},{"filename":"/game/gamestate.lua","crunched":0,"start":12645113,"end":12645498,"audio":false},{"filename":"/game/gametypes.lua","crunched":0,"start":12645498,"end":12645790,"audio":false},{"filename":"/game/hunger.lua","crunched":0,"start":12645790,"end":12660210,"audio":false},{"filename":"/game/mobile_controls_steps.lua","crunched":0,"start":12660210,"end":12665140,"audio":false},{"filename":"/game/mod_terminal.lua","crunched":0,"start":12665140,"end":12690410,"audio":false},{"filename":"/game/mods.lua","crunched":0,"start":12690410,"end":12697352,"audio":false},{"filename":"/game/morningtext.lua","crunched":0,"start":12697352,"end":12710741,"audio":false},{"filename":"/game/movement_steps.lua","crunched":0,"start":12710741,"end":12726783,"audio":false},{"filename":"/game/persistent_defaults.lua","crunched":0,"start":12726783,"end":12727069,"audio":false},{"filename":"/game/platform.lua","crunched":0,"start":12727069,"end":12728608,"audio":false},{"filename":"/game/ripple_steps.lua","crunched":0,"start":12728608,"end":12733598,"audio":false},{"filename":"/game/scrolling.lua","crunched":0,"start":12733598,"end":12741909,"audio":false},{"filename":"/game/serialize.lua","crunched":0,"start":12741909,"end":12755331,"audio":false},{"filename":"/game/shaders.lua","crunched":0,"start":12755331,"end":12761737,"audio":false},{"filename":"/game/shopkeeper.lua","crunched":0,"start":12761737,"end":12767302,"audio":false},{"filename":"/game/shopkeeper_dialogue.lua","crunched":0,"start":12767302,"end":12775220,"audio":false},{"filename":"/game/size.lua","crunched":0,"start":12775220,"end":12775767,"audio":false},{"filename":"/game/spawnenemy.lua","crunched":0,"start":12775767,"end":12801452,"audio":false},{"filename":"/game/state.lua","crunched":0,"start":12801452,"end":12806621,"audio":false},{"filename":"/game/storm.lua","crunched":0,"start":12806621,"end":12825595,"audio":false},{"filename":"/game/suit_theme.lua","crunched":0,"start":12825595,"end":12831519,"audio":false},{"filename":"/game/time_utils.lua","crunched":0,"start":12831519,"end":12832663,"audio":false},{"filename":"/game/top.lua","crunched":0,"start":12832663,"end":12843976,"audio":false},{"filename":"/game/update_steps.lua","crunched":0,"start":12843976,"end":12869037,"audio":false},{"filename":"/game/visuals.lua","crunched":0,"start":12869037,"end":12871983,"audio":false},{"filename":"/game/wake_up.lua","crunched":0,"start":12871983,"end":12875124,"audio":false},{"filename":"/game.lua","crunched":0,"start":12875124,"end":12923215,"audio":false},{"filename":"/main.lua","crunched":0,"start":12923215,"end":12935757,"audio":false},{"filename":"/menu.lua","crunched":0,"start":12935757,"end":12952285,"audio":false},{"filename":"/mods/first_tick.txt","crunched":0,"start":12952285,"end":12952311,"audio":false},{"filename":"/sand.lua","crunched":0,"start":12952311,"end":12961859,"audio":false},{"filename":"/shop/controller.lua","crunched":0,"start":12961859,"end":12969050,"audio":false},{"filename":"/shop/economy.lua","crunched":0,"start":12969050,"end":12973444,"audio":false},{"filename":"/shop/inventory_utils.lua","crunched":0,"start":12973444,"end":12974120,"audio":false},{"filename":"/shop/port.lua","crunched":0,"start":12974120,"end":13017890,"audio":false},{"filename":"/shop/state.lua","crunched":0,"start":13017890,"end":13018921,"audio":false},{"filename":"/shop/ui/inventory.lua","crunched":0,"start":13018921,"end":13023859,"audio":false},{"filename":"/shop/ui/main.lua","crunched":0,"start":13023859,"end":13037136,"audio":false},{"filename":"/shop/ui/transfer.lua","crunched":0,"start":13037136,"end":13042592,"audio":false},{"filename":"/shop.lua","crunched":0,"start":13042592,"end":13043460,"audio":false}]});

})();
