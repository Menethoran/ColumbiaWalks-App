/* Used unchanged by Android and iOS. Only fills the verified official form.
 * It never submits, checks Agree, handles CAPTCHA, or attaches a file. */
(function (draft) {
    'use strict';
    const path = '/us/pa/lancaster/columbia-boro-pd/10552/submit-tip';
    if (window.top !== window || location.origin !== 'https://crimewatch.net' ||
            location.pathname.replace(/\/$/, '') !== path) return 'wrong-page';
    const form = document.getElementById('webform-client-form-142312');
    const anonymous = document.getElementById('edit-submitted-person-anonymous-2');
    const crime = document.getElementById('edit-submitted-narrative-crime');
    const subject = document.getElementById('edit-submitted-narrative-subject');
    const message = document.getElementById('edit-submitted-narrative-notes');
    if (!form || !anonymous || !crime || !subject || !message ||
            anonymous.form !== form || crime.form !== form || subject.form !== form || message.form !== form ||
            anonymous.value !== '1' || !Array.from(crime.options).some(o => o.value === 'Other') ||
            new URL(form.action, location.href).origin !== location.origin ||
            new URL(form.action, location.href).pathname !== path) return 'form-changed';
    if (form.dataset.cwTestAutofill === 'true') return 'already-filled';

    const mark = value => {
        const plain = String(value || '').replace(/\[TEST\]/gi, ' ')
            .replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
            .replace(/[\s\p{Z}]+/gu, ' ').trim() || 'Not provided';
        return '[TEST] ' + plain.split(' ').join(' [TEST] ') + ' [TEST]';
    };
    const set = (element, value) => {
        if (element.value === value) return;
        element.value = value;
        element.dispatchEvent(new Event('input', {bubbles: true}));
        element.dispatchEvent(new Event('change', {bubbles: true}));
    };
    const anonymousOther = () => {
        if (!anonymous.checked) anonymous.click();
        set(crime, 'Other');
        // The test is anonymous even if a browser tried to restore contact data.
        ['first-name', 'last-name', 'mail', 'phone-number'].forEach(name => {
            const field = document.getElementById('edit-submitted-person-' + name);
            if (field && field.form === form) set(field, '');
        });
    };
    const enforce = () => {
        anonymousOther();
        set(subject, mark(subject.value));
        set(message, mark(message.value));
        subject.setCustomValidity(subject.value.length > 128
            ? '[TEST] Shorten the subject: the 128-character limit includes test markers.' : '');
    };
    // Preserve edits if CRIMEWATCH returns this form after validation; do not reapply the original draft.
    set(subject, mark(subject.value || draft.subject));
    set(message, mark(message.value || draft.message));
    enforce();
    form.dataset.cwTestAutofill = 'true';
    const banner = document.createElement('p');
    banner.textContent = '[TEST] ColumbiaWalks 3.17.10 police-assisted test. Anonymous / Other. Review the marked text, personally accept the agreement, complete any CAPTCHA, and press Submit when ready. Autofill is not submission.';
    banner.setAttribute('role', 'note');
    banner.style.cssText = 'background:#fff3c4;color:#332400;padding:14px;border:3px solid #946000;font-weight:bold;';
    form.prepend(banner);
    // Apply before browser constraint validation as well as before any form submit listener.
    form.addEventListener('click', event => {
        if (event.target.closest('input[type="submit"],button[type="submit"],button:not([type])')) enforce();
    }, true);
    form.addEventListener('submit', event => {
        enforce();
        if (!form.checkValidity()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            form.reportValidity();
        }
    }, true);
    subject.addEventListener('input', () => subject.setCustomValidity(''));
    return subject.value.length <= 128 && anonymous.checked && crime.value === 'Other'
        ? 'filled' : 'review-required';
})
