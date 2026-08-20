/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneNavigatorTrackElement = document.querySelector('#sceneNavigatorTrack');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  //
  // Seismic Museum addition: `stage.preserveDrawingBuffer` is set so the
  // camera/snapshot feature below can read the WebGL canvas synchronously at
  // click time. Marzipano's render loop is render-on-demand (it only draws
  // when the view changes), so without this the drawing buffer can already
  // be cleared by the time a screenshot is requested, producing a blank
  // capture. This is a standard, documented Marzipano stage option (not a
  // patch to vendor internals) and has no effect on scene data, hotspot
  // topology, or navigation -- it only affects how the WebGL canvas retains
  // its buffer between paints.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    },
    stage: {
      preserveDrawingBuffer: true
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Seismic Museum addition: build the bottom scene navigator (all scenes,
  // horizontally scrollable) and wire each thumbnail to the same
  // switchScene() used everywhere else -- see buildSceneNavigator() below.
  buildSceneNavigator();

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneNavigator(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  // Seismic Museum addition: bottom scene navigator (replaces the removed
  // top-left expandable numbered scene list). Built once from the full
  // `scenes` array -- all 33 panoramas are always in the DOM; only ~7 are
  // visible at once, the rest reachable by horizontal scroll. Reuses the
  // existing preview.jpg each scene already has (a stacked 256x256 cube-face
  // strip): cropping to its first frame via a fixed-height, overflow-hidden
  // background-image is a real photographic thumbnail with no extra asset
  // generation or build step.
  function buildSceneNavigator() {
    if (!sceneNavigatorTrackElement) {
      return;
    }
    scenes.forEach(function(scene, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sceneThumb';
      button.setAttribute('data-id', scene.data.id);
      button.setAttribute('aria-current', 'false');
      button.setAttribute(
        'aria-label',
        'Scene ' + (index + 1) + ' of ' + scenes.length + ': ' + scene.data.name
      );

      var image = document.createElement('span');
      image.className = 'sceneThumb-image';
      image.setAttribute('aria-hidden', 'true');
      image.style.backgroundImage = 'url(' + previewUrlForScene(scene.data.id) + ')';

      var meta = document.createElement('span');
      meta.className = 'sceneThumb-meta';

      var title = document.createElement('span');
      title.className = 'sceneThumb-title';
      title.textContent = sanitizePlain(scene.data.name);

      var dot = document.createElement('span');
      dot.className = 'sceneThumb-dot';
      dot.setAttribute('aria-hidden', 'true');

      meta.appendChild(title);
      meta.appendChild(dot);
      button.appendChild(image);
      button.appendChild(meta);

      button.addEventListener('click', function() {
        switchScene(scene);
      });

      sceneNavigatorTrackElement.appendChild(button);
    });
  }

  function previewUrlForScene(sceneId) {
    return 'tiles/' + sceneId + '/preview.jpg';
  }

  function sanitizePlain(s) {
    // textContent assignment already escapes markup; this only strips
    // characters that would otherwise render oddly in the compact label.
    return String(s).trim();
  }

  function updateSceneNavigator(scene) {
    if (!sceneNavigatorTrackElement) {
      return;
    }
    var thumbs = sceneNavigatorTrackElement.querySelectorAll('.sceneThumb');
    var activeThumb = null;
    for (var i = 0; i < thumbs.length; i++) {
      var isCurrent = thumbs[i].getAttribute('data-id') === scene.data.id;
      thumbs[i].setAttribute('aria-current', isCurrent ? 'true' : 'false');
      if (isCurrent) {
        activeThumb = thumbs[i];
      }
    }
    if (activeThumb && activeThumb.scrollIntoView) {
      var reduceMotion =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      activeThumb.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Display the initial scene.
  switchScene(scenes[0]);

  // ------------------------------------------------------------------
  // Seismic Museum addition: snapshot / screenshot system.
  //
  // Purely additive -- reads the existing viewer/canvas and DOM, does not
  // touch scene authoring, hotspot topology, or navigation. See the
  // `stage.preserveDrawingBuffer` note above for why the capture is
  // reliable regardless of when the visitor clicks.
  // ------------------------------------------------------------------
  (function initScreenshot() {
    var screenshotButton = document.querySelector('#screenshotButton');
    var screenshotStatusElement = document.querySelector('#screenshotStatus');
    if (!screenshotButton) {
      return;
    }

    // Configurable overlay branding. The owner has not supplied a final PNG
    // yet, so this ships disabled (`enabled: false`) and the capture engine
    // must work completely without it. Once the final asset arrives, drop
    // it in `img/` and flip `enabled: true` (and adjust the other values as
    // needed) -- no capture logic needs to change.
    var SCREENSHOT_OVERLAY = {
      assetPath: 'img/overlay.png',
      enabled: false,
      anchor: 'bottom-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
      widthRatio: 0.22, // overlay width as a fraction of the captured image's width
      maxWidthPx: 420, // hard cap so the overlay never dominates a large capture
      opacity: 1,
      margin: 28, // px inset from the frame edge for corner anchors
      offsetX: 0, // px fine-tune nudge, applied after anchor + margin
      offsetY: 0
    };

    // Long-edge cap on the exported PNG. Marzipano already sizes the WebGL
    // canvas backing buffer by devicePixelRatio (so raw captures are already
    // retina-sharp); this only guards against absurdly large files on
    // high-DPR mobile/tablet screens by downscaling the *captured* bitmap,
    // never the live panorama render itself.
    var MAX_CAPTURE_DIMENSION = 2400;

    var busy = false;

    function currentSceneId() {
      var el = document.querySelector('.sceneThumb[aria-current="true"]');
      return el ? el.getAttribute('data-id') : 'scene';
    }

    function sanitizeForFilename(value) {
      var safe = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return safe || 'scene';
    }

    function buildFilename() {
      var scene = sanitizeForFilename(currentSceneId());
      var ts = new Date().toISOString().replace(/[:.]/g, '-');
      return 'seismic-museum-' + scene + '-' + ts + '.png';
    }

    function setStatus(message, isError) {
      if (!screenshotStatusElement) {
        return;
      }
      screenshotStatusElement.textContent = message || '';
      screenshotStatusElement.classList.toggle('is-error', !!isError);
    }

    function exportCanvas(canvas, callback) {
      if (canvas.toBlob) {
        canvas.toBlob(function(blob) {
          if (!blob) {
            callback(new Error('Canvas produced an empty capture'));
            return;
          }
          callback(null, blob);
        }, 'image/png');
        return;
      }
      // Fallback for browsers without HTMLCanvasElement.toBlob.
      try {
        var dataUrl = canvas.toDataURL('image/png');
        var binary = atob(dataUrl.split(',')[1]);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        callback(null, new Blob([bytes], { type: 'image/png' }));
      } catch (err) {
        callback(err);
      }
    }

    function compositeOverlayAndExport(sourceCanvas, callback) {
      if (!SCREENSHOT_OVERLAY.enabled) {
        exportCanvas(sourceCanvas, callback);
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        try {
          var out = document.createElement('canvas');
          out.width = sourceCanvas.width;
          out.height = sourceCanvas.height;
          var ctx = out.getContext('2d');
          ctx.drawImage(sourceCanvas, 0, 0);

          var targetW = Math.min(SCREENSHOT_OVERLAY.maxWidthPx, out.width * SCREENSHOT_OVERLAY.widthRatio);
          var scale = targetW / img.naturalWidth;
          var targetH = img.naturalHeight * scale;
          var margin = SCREENSHOT_OVERLAY.margin;
          var x, y;

          switch (SCREENSHOT_OVERLAY.anchor) {
            case 'top-left':
              x = margin;
              y = margin;
              break;
            case 'top-right':
              x = out.width - targetW - margin;
              y = margin;
              break;
            case 'bottom-left':
              x = margin;
              y = out.height - targetH - margin;
              break;
            case 'center':
              x = (out.width - targetW) / 2;
              y = (out.height - targetH) / 2;
              break;
            case 'bottom-right':
            default:
              x = out.width - targetW - margin;
              y = out.height - targetH - margin;
              break;
          }

          x += SCREENSHOT_OVERLAY.offsetX || 0;
          y += SCREENSHOT_OVERLAY.offsetY || 0;

          ctx.globalAlpha = SCREENSHOT_OVERLAY.opacity;
          ctx.drawImage(img, x, y, targetW, targetH);
          ctx.globalAlpha = 1;
          exportCanvas(out, callback);
        } catch (err) {
          callback(err);
        }
      };
      img.onerror = function() {
        // Overlay asset missing/broken: fail open with the plain capture
        // rather than blocking the whole feature on a branding asset.
        exportCanvas(sourceCanvas, callback);
      };
      img.src = SCREENSHOT_OVERLAY.assetPath;
    }

    function captureCurrentView(callback) {
      try {
        var sourceCanvas = panoElement.querySelector('canvas');
        if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
          callback(new Error('Panorama canvas is not ready'));
          return;
        }

        var longEdge = Math.max(sourceCanvas.width, sourceCanvas.height);
        var scale = longEdge > MAX_CAPTURE_DIMENSION ? MAX_CAPTURE_DIMENSION / longEdge : 1;

        if (scale === 1) {
          compositeOverlayAndExport(sourceCanvas, callback);
          return;
        }

        var scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.round(sourceCanvas.width * scale);
        scaledCanvas.height = Math.round(sourceCanvas.height * scale);
        var ctx = scaledCanvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        compositeOverlayAndExport(scaledCanvas, callback);
      } catch (err) {
        callback(err);
      }
    }

    function downloadBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 4000);
    }

    // Seismic Museum addition: persist a copy of every capture to Blob
    // storage with metadata (project/panorama/dimensions/template), in
    // addition to the visitor's local download -- see api/screenshots.ts.
    // `userId` is always null: there's no authentication system in this
    // project yet, so every capture is anonymous until real auth exists
    // (see the docs on ScreenshotRecord). Best-effort and silent: a failed
    // persist never blocks or degrades the download the visitor asked for.
    function persistScreenshot(blob, sceneId) {
      if (!window.VercelBlobClient || typeof window.VercelBlobClient.upload !== 'function') {
        return;
      }
      var img = new Image();
      var objectUrl = URL.createObjectURL(blob);
      img.onload = function() {
        var width = img.naturalWidth;
        var height = img.naturalHeight;
        URL.revokeObjectURL(objectUrl);
        window.VercelBlobClient
          .upload('museum-screenshot.png', blob, {
            access: 'public',
            handleUploadUrl: '/api/screenshot-upload'
          })
          .then(function(result) {
            return fetch('/api/screenshots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: 'modern-museum',
                panoramaId: sceneId,
                media: {
                  url: result.url,
                  pathname: result.pathname,
                  contentType: 'image/png'
                },
                width: width,
                height: height,
                template: SCREENSHOT_OVERLAY.enabled ? 'owner-overlay' : null,
                viewport: { width: window.innerWidth, height: window.innerHeight }
              })
            });
          })
          .catch(function(err) {
            if (window.console && window.console.warn) {
              window.console.warn('Seismic Museum: screenshot persist failed (download still succeeded)', err);
            }
          });
      };
      img.onerror = function() {
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    }

    screenshotButton.addEventListener('click', function() {
      if (busy) {
        return;
      }
      busy = true;
      screenshotButton.classList.add('is-capturing');
      setStatus('');

      captureCurrentView(function(err, blob) {
        screenshotButton.classList.remove('is-capturing');
        busy = false;

        if (err || !blob) {
          if (window.console && window.console.error) {
            window.console.error('Seismic Museum: screenshot capture failed', err);
          }
          setStatus('Unable to capture this view. Please try again.', true);
          return;
        }

        screenshotButton.classList.add('did-capture');
        setTimeout(function() {
          screenshotButton.classList.remove('did-capture');
        }, 600);

        downloadBlob(blob, buildFilename());
        persistScreenshot(blob, currentSceneId());
        setStatus('Snapshot saved.');
      });
    });
  })();

})();
