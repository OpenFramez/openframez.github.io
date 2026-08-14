/**
 * OpenFramez — Feedback Button + Modal
 *
 * Floating "report a problem" button visible on every page.
 * Opens a small modal where the user can write a message and pick a
 * category (bug / feedback / question). The message is sent to
 * OpenFramezErrors which files it as a GitHub Issue with the user-report label.
 *
 * @author OpenFramez Team
 */

(function () {
  'use strict';

  // Wait for DOM
  function init() {
    if (!window.OpenFramezErrors) {
      // Error reporter not loaded — skip
      return;
    }
    if (document.querySelector('.feedback-btn')) return; // already injected

    // Inject CSS link if not already present
    if (!document.querySelector('link[href*="feedback.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/feedback.css';
      document.head.appendChild(link);
    }

    // Build button
    var btn = document.createElement('button');
    btn.className = 'feedback-btn';
    btn.setAttribute('aria-label', 'گزارش مشکل یا بازخورد');
    btn.setAttribute('title', 'گزارش مشکل یا بازخورد');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  function openModal() {
    // Build modal (one-shot per session — re-use if already built)
    var existing = document.querySelector('.feedback-modal');
    if (existing) {
      existing.classList.add('open');
      return;
    }

    var modal = document.createElement('div');
    modal.className = 'feedback-modal';
    modal.innerHTML = `
      <div class="feedback-modal-card" role="dialog" aria-labelledby="fbTitle">
        <h2 id="fbTitle">گزارش مشکل یا بازخورد</h2>
        <p>اگر مشکلی دیدید یا پیشنهادی دارید، اینجا بنویسید. گزارش شما مستقیم به تیم ما می‌رسد.</p>
        <div class="feedback-type-row">
          <label><input type="radio" name="fb-type" value="bug" checked><span>🐛 مشکل</span></label>
          <label><input type="radio" name="fb-type" value="feedback"><span>💡 پیشنهاد</span></label>
          <label><input type="radio" name="fb-type" value="question"><span>❓ سوال</span></label>
        </div>
        <textarea id="fbMessage" placeholder="مشکل یا پیشنهاد خود را اینجا بنویسید..." maxlength="2000"></textarea>
        <div class="feedback-actions">
          <button type="button" class="btn btn-ghost" id="fbCancel">انصراف</button>
          <button type="button" class="btn btn-primary" id="fbSend">ارسال</button>
        </div>
        <div class="feedback-status hidden" id="fbStatus"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // Show
    requestAnimationFrame(function () { modal.classList.add('open'); });

    // Close on backdrop click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal(modal);
    });

    // Cancel button
    modal.querySelector('#fbCancel').addEventListener('click', function () {
      closeModal(modal);
    });

    // Send button
    modal.querySelector('#fbSend').addEventListener('click', function () {
      var message = modal.querySelector('#fbMessage').value.trim();
      if (!message) {
        showStatus(modal, 'error', 'لطفاً پیام خود را بنویسید');
        return;
      }
      var category = 'bug';
      var radios = modal.querySelectorAll('input[name="fb-type"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) { category = radios[i].value; break; }
      }

      showStatus(modal, 'sending', 'در حال ارسال...');
      window.OpenFramezErrors.send({ message: message, category: category })
        .then(function (result) {
          if (result && result.skipped) {
            showStatus(modal, 'error', 'ریت‌لیمت شده — لطفاً چند ثانیه بعد دوباره تلاش کنید');
          } else if (result && result.html_url) {
            showStatus(modal, 'success', 'ارسال شد! ممنون از بازخوردتان. 👍');
            setTimeout(function () { closeModal(modal); }, 2500);
          } else {
            showStatus(modal, 'error', 'ارسال ناموفق بود. بعداً دوباره تلاش کنید.');
          }
        })
        .catch(function () {
          showStatus(modal, 'error', 'خطای شبکه. بعداً دوباره تلاش کنید.');
        });
    });

    // Focus textarea
    setTimeout(function () { modal.querySelector('#fbMessage').focus(); }, 100);
  }

  function closeModal(modal) {
    modal.classList.remove('open');
    // Remove from DOM after transition
    setTimeout(function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    }, 300);
  }

  function showStatus(modal, type, msg) {
    var status = modal.querySelector('#fbStatus');
    status.className = 'feedback-status ' + type;
    status.textContent = msg;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
