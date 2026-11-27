/**
 * 广告位管理模块（全站共用）
 * ------------------------------------------------------------
 * 设计目标：现在不影响游戏体验，后期接入广告零改动页面。
 *
 * 使用方法：
 *   1. 在任意页面需要广告的地方写：<div data-ad-slot="banner-top"></div>
 *   2. 本脚本会自动扫描所有 [data-ad-slot] 并注入广告（或占位）。
 *
 * 后期接入真实广告（如百度联盟 / 穿山甲 / Google AdSense）：
 *   只需把 AD_CONFIG.enabled 设为 true，并在 renderSlot() 中
 *   按 slot 名称填入对应 SDK 代码即可，页面无需任何改动。
 */
(function (global) {
  'use strict';

  // ============ 全局配置：后期挂广告只改这里 ============
  var AD_CONFIG = {
    enabled: false,        // 总开关：false=不显示任何广告（当前）；true=显示广告位
    showPlaceholder: true, // enabled 时是否显示占位框（接入真实广告后设为 false）
    // 各广告位尺寸/说明，接入 SDK 时可据此选择广告规格
    slots: {
      'banner-top':    { label: '顶部横幅广告', size: '728×90 / 320×50' },
      'banner-bottom': { label: '底部横幅广告', size: '728×90 / 320×50' },
      'card-inline':   { label: '游戏列表信息流广告', size: '自适应' },
      'rewarded':      { label: '激励视频广告（通关后可看）', size: '视频' }
    }
  };

  /**
   * 渲染单个广告位。
   * 接入真实广告时，在此函数内按 slot 名称分支填入 SDK 代码。
   */
  function renderSlot(el, slotName) {
    if (!AD_CONFIG.enabled) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';

    if (AD_CONFIG.showPlaceholder) {
      var info = AD_CONFIG.slots[slotName] || { label: slotName, size: '自适应' };
      el.innerHTML =
        '<div class="ad-placeholder" title="后期接入广告的位置">' +
        '<span class="ad-placeholder-tag">广告</span>' +
        '<span>' + info.label + ' · ' + info.size + '</span>' +
        '</div>';
      return;
    }

    // ---- 后期接入真实广告 SDK 的位置 ----
    // 示例结构（按实际平台替换）：
    // if (slotName === 'banner-top') {
    //   // 百度联盟 / AdSense 代码片段
    // }
  }

  function init() {
    var slots = document.querySelectorAll('[data-ad-slot]');
    for (var i = 0; i < slots.length; i++) {
      renderSlot(slots[i], slots[i].getAttribute('data-ad-slot'));
    }
  }

  // 暴露给外部：允许运行时开启广告（如后台配置下发）
  global.AdManager = {
    config: AD_CONFIG,
    init: init,
    enable: function (showPlaceholder) {
      AD_CONFIG.enabled = true;
      AD_CONFIG.showPlaceholder = showPlaceholder !== false;
      init();
    },
    disable: function () {
      AD_CONFIG.enabled = false;
      init();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
