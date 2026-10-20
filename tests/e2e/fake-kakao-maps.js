/* eslint-disable @typescript-eslint/no-this-alias -- 브라우저에 그대로 주입하는 ES5 스크립트라 this 별칭을 쓴다 */
/*
 * E2E 전용 가짜 카카오맵 SDK. 실제 SDK(dapi.kakao.com)는 키·네트워크가 필요하므로,
 * 앱이 쓰는 API 범위(src/lib/kakao-maps.ts)만 같은 모양으로 흉내 낸다. 타일은 그리지 않는다.
 * 레벨 L에서 화면 1px = 0.00002 * 2^(L-1)도(위경도 모두)로 단순 투영한다.
 */
(function () {
  function LatLng(lat, lng) { this.lat = lat; this.lng = lng; }
  LatLng.prototype.getLat = function () { return this.lat; };
  LatLng.prototype.getLng = function () { return this.lng; };

  function LatLngBounds(sw, ne) { this.sw = sw || null; this.ne = ne || null; }
  LatLngBounds.prototype.extend = function (p) {
    if (!this.sw) { this.sw = new LatLng(p.lat, p.lng); this.ne = new LatLng(p.lat, p.lng); return; }
    this.sw = new LatLng(Math.min(this.sw.lat, p.lat), Math.min(this.sw.lng, p.lng));
    this.ne = new LatLng(Math.max(this.ne.lat, p.lat), Math.max(this.ne.lng, p.lng));
  };
  LatLngBounds.prototype.contain = function (p) {
    return !!this.sw && p.lat >= this.sw.lat && p.lat <= this.ne.lat && p.lng >= this.sw.lng && p.lng <= this.ne.lng;
  };
  LatLngBounds.prototype.getSouthWest = function () { return this.sw; };
  LatLngBounds.prototype.getNorthEast = function () { return this.ne; };

  var listeners = new WeakMap();
  function fire(target, type) {
    var all = listeners.get(target) || {};
    (all[type] || []).forEach(function (fn) { fn(); });
  }
  var event = {
    addListener: function (target, type, fn) {
      var all = listeners.get(target) || {};
      (all[type] = all[type] || []).push(fn);
      listeners.set(target, all);
    },
  };

  function degPerPx(level) { return 0.00002 * Math.pow(2, level - 1); }

  function Map(container, options) {
    this.container = container;
    container.style.position = "relative";
    container.style.overflow = "hidden";
    this.pane = document.createElement("div");
    this.pane.style.cssText = "position:absolute;inset:0;";
    this.pane.dataset.fakeKakaoMap = "true";
    container.append(this.pane);
    this.center = options.center;
    this.level = options.level;
    this.minLevel = 1;
    this.maxLevel = 14;
    this.overlays = new Set();
    var self = this;
    container.addEventListener("click", function (e) { if (e.target === self.pane) fire(self, "click"); });
    this._idle();
  }
  Map.prototype._size = function () { return { w: this.container.clientWidth || 800, h: this.container.clientHeight || 600 }; };
  Map.prototype._idle = function () {
    var self = this;
    clearTimeout(this._t);
    this._t = setTimeout(function () { self.overlays.forEach(function (o) { o._place(); }); fire(self, "idle"); }, 0);
  };
  Map.prototype.project = function (p) {
    var s = this._size(), d = degPerPx(this.level);
    return { x: s.w / 2 + (p.lng - this.center.lng) / d, y: s.h / 2 - (p.lat - this.center.lat) / d };
  };
  Map.prototype.setCenter = function (p) { this.center = p; this._idle(); };
  Map.prototype.getCenter = function () { return this.center; };
  Map.prototype.panTo = function (p) { this.setCenter(p); };
  Map.prototype.getLevel = function () { return this.level; };
  Map.prototype.setMinLevel = function (l) { this.minLevel = l; };
  Map.prototype.setMaxLevel = function (l) { this.maxLevel = l; };
  Map.prototype.setLevel = function (l, opts) {
    var next = Math.min(this.maxLevel, Math.max(this.minLevel, l));
    if (opts && opts.anchor) this.center = opts.anchor;
    if (next !== this.level) { this.level = next; fire(this, "zoom_changed"); }
    this._idle();
  };
  Map.prototype.getBounds = function () {
    var s = this._size(), d = degPerPx(this.level);
    return new LatLngBounds(
      new LatLng(this.center.lat - (s.h / 2) * d, this.center.lng - (s.w / 2) * d),
      new LatLng(this.center.lat + (s.h / 2) * d, this.center.lng + (s.w / 2) * d)
    );
  };
  Map.prototype.setBounds = function (b, pt, pr, pb, pl) {
    if (!b.sw) return;
    var s = this._size();
    var w = Math.max(1, s.w - (pl || 0) - (pr || 0)), h = Math.max(1, s.h - (pt || 0) - (pb || 0));
    this.center = new LatLng((b.sw.lat + b.ne.lat) / 2, (b.sw.lng + b.ne.lng) / 2);
    var level = this.maxLevel;
    for (var l = this.minLevel; l <= this.maxLevel; l++) {
      var d = degPerPx(l);
      if ((b.ne.lng - b.sw.lng) / d <= w && (b.ne.lat - b.sw.lat) / d <= h) { level = l; break; }
    }
    if (level !== this.level) { this.level = level; fire(this, "zoom_changed"); }
    this._idle();
  };
  Map.prototype.relayout = function () { this._idle(); };

  function CustomOverlay(opts) {
    this.position = opts.position;
    this.content = opts.content;
    this.z = opts.zIndex || 0;
    this.yAnchor = opts.yAnchor == null ? 0.5 : opts.yAnchor;
    this.el = document.createElement("div");
    this.el.style.position = "absolute";
    this.el.append(this.content);
    this.map = null;
    if (opts.map) this.setMap(opts.map);
  }
  CustomOverlay.prototype._place = function () {
    if (!this.map) return;
    var p = this.map.project(this.position);
    this.el.style.left = p.x + "px";
    this.el.style.top = p.y + "px";
    this.el.style.zIndex = String(this.z);
    this.el.style.transform = this.yAnchor === 1 ? "translate(-50%, -100%)" : "";
  };
  CustomOverlay.prototype.setMap = function (map) {
    if (this.map) { this.map.overlays.delete(this); this.el.remove(); }
    this.map = map;
    if (map) { map.overlays.add(this); map.pane.append(this.el); this._place(); }
  };
  CustomOverlay.prototype.setPosition = function (p) { this.position = p; this._place(); };
  CustomOverlay.prototype.setContent = function (c) { this.el.replaceChildren(c); this.content = c; };
  CustomOverlay.prototype.setZIndex = function (z) { this.z = z; this._place(); };

  window.kakao = {
    maps: {
      LatLng: LatLng,
      LatLngBounds: LatLngBounds,
      Map: Map,
      CustomOverlay: CustomOverlay,
      event: event,
      load: function (cb) { setTimeout(cb, 0); },
    },
  };
})();
