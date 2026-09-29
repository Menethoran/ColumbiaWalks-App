/* Local preparation only. No network, storage, popup control, or police submission. */
(() => {
    'use strict';
    const panel = document.getElementById('cw-tip-draft');
    if (!panel) return;
    const get = id => document.getElementById(id);
    const status = get('cw-tip-status');
    const result = get('cw-tip-prepared');
    const fields = ['subject', 'when', 'where', 'vehicle', 'observation', 'evidence'];
    const plain = value => String(value || '').replace(/\[TEST\]/gi, ' ')
        .replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
        .replace(/[\s\p{Z}]+/gu, ' ').trim();
    const mark = value => '[TEST] ' + (plain(value) || 'Not provided').split(' ').join(' [TEST] ') + ' [TEST]';
    const invalidate = () => { result.hidden = true; status.textContent = 'Draft changed. Prepare it again before copying.'; };
    for (const name of fields) get('cw-tip-' + name).addEventListener('input', invalidate);
    get('cw-tip-inactive').addEventListener('change', invalidate);
    get('cw-tip-prepare').addEventListener('click', () => {
        result.hidden = true;
        if (!get('cw-tip-inactive').checked) {
            status.textContent = 'Confirm this is a past or non-active matter. Call 911 for an emergency.';
            get('cw-tip-inactive').focus(); return;
        }
        for (const name of ['subject', 'when', 'where', 'observation']) {
            if (!plain(get('cw-tip-' + name).value)) {
                status.textContent = 'Complete the subject, date/time, location, and firsthand observation.';
                get('cw-tip-' + name).focus(); return;
            }
        }
        const subject = mark(get('cw-tip-subject').value);
        if (subject.length > 128) {
            status.textContent = 'Shorten the subject: CRIMEWATCH allows 128 characters including every [TEST] marker.';
            get('cw-tip-subject').focus(); return;
        }
        const message = mark([
            'COLUMBIAWALKS TEST — ANONYMOUS — OTHER — PAST / NOT IN PROGRESS',
            'Subject: ' + plain(get('cw-tip-subject').value),
            'Observed date/time: ' + plain(get('cw-tip-when').value),
            'Location: ' + plain(get('cw-tip-where').value),
            'Vehicle / plate: ' + (plain(get('cw-tip-vehicle').value) || 'Not provided'),
            'Firsthand observation: ' + plain(get('cw-tip-observation').value),
            'Evidence available: ' + (plain(get('cw-tip-evidence').value) || 'Not provided'),
            'Prepared locally in my browser. I will review and submit personally on the official form.'
        ].join('\n\n'));
        get('cw-tip-output-subject').value = subject;
        get('cw-tip-output-message').value = message;
        result.hidden = false;
        status.textContent = '[TEST] Text prepared on this device. No tip has been submitted.';
    });
    for (const name of ['subject', 'message']) get('cw-tip-copy-' + name).addEventListener('click', async () => {
        const output = get('cw-tip-output-' + name);
        try {
            await navigator.clipboard.writeText(output.value);
            status.textContent = '[TEST] ' + name + ' copied. Paste it on CRIMEWATCH; nothing has been submitted.';
        } catch (_) {
            output.focus(); output.select();
            status.textContent = 'Text selected. Use your device’s Copy command, then paste it on CRIMEWATCH.';
        }
    });
})();
