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
  // visible at once, the rest reachable by horizontal scroll. Each
  // thumbnail's image is that scene's own front cube-face tile
  // (tiles/<id>/1/f/0/0.jpg) -- the lowest-resolution, single-tile "f"
  // face Marzipano already generates for every scene as a fallback level,
  // reused as-is. This is a real per-scene photographic view, not a
  // generated or placeholder asset: earlier this used the stacked
  // preview.jpg (six 256x256 cube faces concatenated vertically) cropped
  // to its first ~68px, which showed only a sliver of whichever face
  // happens to be stacked first (often a blank ceiling/floor) -- the
  // individual face tile is a complete, correctly-oriented image instead.
  function buildSceneNavigator() {
    if (!sceneNavigatorTrackElement) {
      return;
    }
    scenes.forEach(function(scene, index) {
      var number = index + 1;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sceneThumb';
      button.setAttribute('data-id', scene.data.id);
      button.setAttribute('aria-current', 'false');
      button.setAttribute(
        'aria-label',
        'Scene ' + number + ' of ' + scenes.length + ': ' + scene.data.name
      );

      var image = document.createElement('span');
      image.className = 'sceneThumb-image';
      image.setAttribute('aria-hidden', 'true');
      image.style.backgroundImage = 'url(' + previewUrlForScene(scene.data.id) + ')';

      var badge = document.createElement('span');
      badge.className = 'sceneThumb-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = number < 10 ? '0' + number : String(number);
      image.appendChild(badge);

      button.appendChild(image);

      button.addEventListener('click', function() {
        switchScene(scene);
      });

      sceneNavigatorTrackElement.appendChild(button);
    });
  }

  function previewUrlForScene(sceneId) {
    return 'tiles/' + sceneId + '/1/f/0/0.jpg';
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

    var previewRoot = document.querySelector('#screenshotPreview');
    var previewImage = document.querySelector('#screenshotPreviewImage');
    var previewClose = document.querySelector('#screenshotPreviewClose');
    var previewScrim = document.querySelector('#screenshotPreviewScrim');
    var previewSaveButton = document.querySelector('#screenshotPreviewSave');
    var previewDownloadButton = document.querySelector('#screenshotPreviewDownload');
    var previewShareButton = document.querySelector('#screenshotPreviewShare');
    var previewStatusElement = document.querySelector('#screenshotPreviewStatus');

    // Every capture is composited into this exact size, regardless of the
    // visitor's viewport -- the museum screenshot is a fixed-format
    // artwork (16:9, matching the five supplied templates 1:1), not a raw
    // viewport grab. The source panorama capture is cover-cropped (a
    // single uniform scale, cropped on one axis -- never a non-uniform
    // stretch) to fill this frame before a template is drawn on top.
    var OUTPUT_WIDTH = 1920;
    var OUTPUT_HEIGHT = 1080;
    var TEMPLATE_COUNT = 5;

    function templatePath(id) {
      return '/screenshot-templates/template-' + id + '.png';
    }

    // Long-edge cap on the raw *source* grab before it's cover-cropped to
    // the fixed output size -- guards against excessive memory/CPU on
    // high-DPR screens, never affects the final 1920x1080 output.
    var MAX_CAPTURE_DIMENSION = 2400;

    var busy = false;
    var currentPreview = null; // { blob, objectUrl, sceneId, sceneTitle, templateId, saved }

    function currentSceneId() {
      var el = document.querySelector('.sceneThumb[aria-current="true"]');
      return el ? el.getAttribute('data-id') : 'scene';
    }

    function currentSceneTitle(sceneId) {
      var sceneData = findSceneDataById(sceneId);
      return sceneData && sceneData.name ? sceneData.name : sceneId;
    }

    function sanitizeForFilename(value) {
      var safe = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return safe || 'scene';
    }

    function buildFilename(sceneId) {
      var scene = sanitizeForFilename(sceneId);
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

    function setPreviewStatus(message, isError) {
      if (!previewStatusElement) {
        return;
      }
      previewStatusElement.textContent = message || '';
      previewStatusElement.classList.toggle('is-error', !!isError);
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

    // A proper random pick (uniform over 1..TEMPLATE_COUNT), not tied to
    // the current panorama or capture order -- each of the five templates
    // has an equal ~20% chance on every capture.
    function pickRandomTemplateId() {
      return Math.floor(Math.random() * TEMPLATE_COUNT) + 1;
    }

    var templateImageCache = {};
    function loadTemplateImage(id, callback) {
      if (templateImageCache[id]) {
        callback(null, templateImageCache[id]);
        return;
      }
      var img = new Image();
      img.onload = function() {
        templateImageCache[id] = img;
        callback(null, img);
      };
      img.onerror = function() {
        callback(new Error('Template image failed to load: ' + templatePath(id)));
      };
      img.src = templatePath(id);
    }

    // Cover-crop `sourceCanvas` into a new WxH canvas without distorting
    // it: a single uniform scale (max of the two axis ratios), with the
    // excess on whichever axis overflows cropped off-center. Never a
    // non-uniform (independent x/y) stretch.
    function coverCropToCanvas(sourceCanvas, width, height) {
      var out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      var ctx = out.getContext('2d');
      var sw = sourceCanvas.width;
      var sh = sourceCanvas.height;
      var targetRatio = width / height;
      var sourceRatio = sw / sh;
      var sx, sy, sWidth, sHeight;
      if (sourceRatio > targetRatio) {
        sHeight = sh;
        sWidth = sh * targetRatio;
        sx = (sw - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = sw;
        sHeight = sw / targetRatio;
        sx = 0;
        sy = (sh - sHeight) / 2;
      }
      ctx.drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, width, height);
      return out;
    }

    // BASE: the current museum view, cover-cropped to 1920x1080.
    // OVERLAY: the chosen template, drawn at exactly x=0, y=0,
    // width=1920, height=1080 -- it is already a full-frame 1920x1080
    // asset, so this draws it 1:1 with no scaling of its own.
    function composeArtwork(sourceCanvas, templateId, callback) {
      loadTemplateImage(templateId, function(err, templateImg) {
        if (err) {
          callback(err);
          return;
        }
        try {
          var out = coverCropToCanvas(sourceCanvas, OUTPUT_WIDTH, OUTPUT_HEIGHT);
          var ctx = out.getContext('2d');
          ctx.drawImage(templateImg, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
          exportCanvas(out, callback);
        } catch (drawErr) {
          callback(drawErr);
        }
      });
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
        var workingCanvas = sourceCanvas;

        if (scale !== 1) {
          workingCanvas = document.createElement('canvas');
          workingCanvas.width = Math.round(sourceCanvas.width * scale);
          workingCanvas.height = Math.round(sourceCanvas.height * scale);
          workingCanvas.getContext('2d').drawImage(
            sourceCanvas, 0, 0, workingCanvas.width, workingCanvas.height
          );
        }

        var templateId = pickRandomTemplateId();
        composeArtwork(workingCanvas, templateId, function(err, blob) {
          if (err) {
            callback(err);
            return;
          }
          callback(null, blob, templateId);
        });
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

    // Seismic Museum addition: persist the artwork to Blob storage with
    // its metadata -- see api/screenshots.ts. This now runs only when the
    // visitor explicitly clicks "Save to profile" in the preview panel
    // (previously it ran automatically on every capture); the local
    // download and the X share option never depend on this succeeding.
    // `userId` is never sent from the client -- the server always derives
    // it from the session cookie (api/_lib/_session.ts), so an anonymous
    // visitor's save silently records userId: null server-side and a
    // signed-in visitor's records their real account, with no way for the
    // client to claim someone else's identity.
    function persistScreenshot(preview, onDone) {
      if (!window.VercelBlobClient || typeof window.VercelBlobClient.upload !== 'function') {
        onDone(new Error('Upload is not available in this browser'));
        return;
      }
      // The prefix must be requested here, not left to the server to add:
      // @vercel/blob/client's onBeforeGenerateToken callback has no way
      // to rewrite the path server-side, only to validate/reject the
      // path the client asked for (see api/screenshot-upload.ts).
      window.VercelBlobClient
        .upload('screenshots/media/museum-screenshot.png', preview.blob, {
          access: 'public',
          handleUploadUrl: '/api/screenshot-upload'
        })
        .then(function(result) {
          return fetch('/api/screenshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: 'modern-museum',
              panoramaId: preview.sceneId,
              panoramaTitle: preview.sceneTitle,
              media: {
                url: result.url,
                pathname: result.pathname,
                contentType: 'image/png'
              },
              width: OUTPUT_WIDTH,
              height: OUTPUT_HEIGHT,
              template: 'template-' + preview.templateId,
              viewport: { width: window.innerWidth, height: window.innerHeight }
            })
          });
        })
        .then(function(res) {
          if (!res.ok) {
            return res
              .json()
              .catch(function() {
                return {};
              })
              .then(function(body) {
                throw new Error(body.error || 'Save failed with status ' + res.status);
              });
          }
          onDone(null);
        })
        .catch(function(err) {
          onDone(err);
        });
    }

    // A small set of natural-language variations rather than one fixed
    // sentence, per capture -- each keeps the same intent (invite someone
    // to visit) and always includes the museum URL.
    function shareCaptionVariants(url) {
      return [
        'I visited Seismic Museum and discovered this piece.\n\nCome experience it yourself:\n' + url,
        'Found this inside Seismic Museum -- worth the visit.\n\n' + url,
        'A small piece of Seismic Museum, captured.\n\nStep inside yourself:\n' + url,
        'Wandered through Seismic Museum and this one stayed with me.\n\n' + url,
        'Seismic Museum, one frame at a time.\n\nExplore it here:\n' + url
      ];
    }

    // Text-only share: X's web intent can prefill a post's text, but it
    // cannot attach an image without an authenticated X API integration
    // (out of scope here -- no X API/media credentials are configured).
    // The visitor downloads the artwork (button right above this one) and
    // attaches it themselves in X's compose window; this never claims to
    // upload the image on their behalf.
    function openShareIntent() {
      var url = window.location.origin + '/p/modern-museum';
      var variants = shareCaptionVariants(url);
      var text = variants[Math.floor(Math.random() * variants.length)];
      var intentUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
      window.open(intentUrl, '_blank', 'noopener,noreferrer');
    }

    function closePreview() {
      if (!previewRoot) {
        return;
      }
      previewRoot.classList.remove('is-open');
      previewRoot.setAttribute('aria-hidden', 'true');
      if (currentPreview && currentPreview.objectUrl) {
        URL.revokeObjectURL(currentPreview.objectUrl);
      }
      currentPreview = null;
      if (previewImage) {
        previewImage.src = '';
      }
      setPreviewStatus('');
    }

    function openPreview(blob, sceneId, sceneTitle, templateId) {
      if (!previewRoot || !previewImage) {
        return;
      }
      var objectUrl = URL.createObjectURL(blob);
      currentPreview = {
        blob: blob,
        objectUrl: objectUrl,
        sceneId: sceneId,
        sceneTitle: sceneTitle,
        templateId: templateId,
        saved: false
      };
      previewImage.src = objectUrl;
      setPreviewStatus('');
      if (previewSaveButton) {
        previewSaveButton.disabled = false;
        previewSaveButton.textContent = 'Save to profile';
      }
      previewRoot.classList.add('is-open');
      previewRoot.setAttribute('aria-hidden', 'false');
      // Exposed purely for e2e verification that the composited output
      // actually used the randomly-selected template (see
      // e2e/marzipano-tour.spec.ts) -- not read by any user-facing code.
      previewRoot.setAttribute('data-template-id', String(templateId));
    }

    if (previewClose) {
      previewClose.addEventListener('click', closePreview);
    }
    if (previewScrim) {
      previewScrim.addEventListener('click', closePreview);
    }
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && previewRoot && previewRoot.classList.contains('is-open')) {
        closePreview();
      }
    });

    if (previewSaveButton) {
      previewSaveButton.addEventListener('click', function() {
        if (!currentPreview || currentPreview.saved) {
          return;
        }
        previewSaveButton.disabled = true;
        previewSaveButton.textContent = 'Saving...';
        setPreviewStatus('');
        persistScreenshot(currentPreview, function(err) {
          if (err) {
            if (window.console && window.console.warn) {
              window.console.warn('Seismic Museum: screenshot save failed', err);
            }
            previewSaveButton.disabled = false;
            previewSaveButton.textContent = 'Save to profile';
            setPreviewStatus('Could not save this to your profile. Please try again.', true);
            return;
          }
          if (currentPreview) {
            currentPreview.saved = true;
          }
          previewSaveButton.textContent = 'Saved';
          setPreviewStatus('Saved to your profile gallery.');
        });
      });
    }

    if (previewDownloadButton) {
      previewDownloadButton.addEventListener('click', function() {
        if (!currentPreview) {
          return;
        }
        downloadBlob(currentPreview.blob, buildFilename(currentPreview.sceneId));
        setPreviewStatus('Downloaded.');
      });
    }

    if (previewShareButton) {
      previewShareButton.addEventListener('click', function() {
        openShareIntent();
        setPreviewStatus('Opened X in a new tab -- download the image above to attach it to your post.');
      });
    }

    screenshotButton.addEventListener('click', function() {
      if (busy) {
        return;
      }
      busy = true;
      screenshotButton.classList.add('is-capturing');
      setStatus('');

      var sceneId = currentSceneId();
      var sceneTitle = currentSceneTitle(sceneId);

      captureCurrentView(function(err, blob, templateId) {
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

        setStatus('');
        openPreview(blob, sceneId, sceneTitle, templateId);
      });
    });
  })();

})();
