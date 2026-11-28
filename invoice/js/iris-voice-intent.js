/* Call with the final transcript from Iris command mode.
 * Returns a calculation or read-only request, or null for the existing router.
 */
(function (root) {
    'use strict';

    var views = [
        ['pending_approvals', /^(?:what(?:'s| is)\s+)?(?:invoices?\s+)?(?:waiting|pending)\s+for\s+(?:approval|a\s+proval)s?$|^(?:pending\s+)?approvals?$/],
        ['waiting_for_pdf', /^(?:what\s+)?(?:invoices?\s+)?(?:waiting\s+for|missing)\s+(?:the\s+)?p\s*d\s*f(?:s|\s+files?)?$|^what(?:'s| is)\s+waiting\s+for\s+(?:the\s+)?p\s*d\s*fs?$/],
        ['ready_to_print', /^(?:what(?:'s| is)\s+)?(?:invoices?\s+)?ready\s+(?:to|two)\s+print$/],
        ['under_review', /^(?:what(?:'s| is)\s+)?(?:invoices?\s+)?under\s+review$/],
        ['reception_entries', /^(?:what(?:'s| is)\s+(?:in\s+)?)?(?:reception(?:\s+(?:new\s+)?entries)?|new\s+entries(?:\s+in\s+reception)?)$/]
    ];

    function readRequest(text) {
        var request = text
            .replace(/^(?:show(?:\s+me)?|check|find|open|list|track)\s+(?:the\s+)?/, '')
            .replace(/\s+please$/, '');
        var po = request.match(/^(?:status\s+(?:of|for)\s+)?(?:p[.\s]*o\.?|pee\s+oh|purchase\s+order)\s*(?:number\s+)?#?\s*(\d{4,7})$/);
        if (po) return { intent: 'po_lookup', po: po[1] };
        var view = views.find(function (item) { return item[1].test(request); });
        return view ? { intent: view[0] } : null;
    }

    function interpret(transcript) {
        if (typeof transcript !== 'string') return null;
        var text = transcript.toLowerCase().trim().replace(/[.!?]+$/, '');
        var match = text.match(/^(?:hey\s+)?(?:iris[,:]?\s+)?(?:please\s+)?(?:sum|some|add)\s+(-?\d+(?:\.\d+)?)\s*(?:\+|plus|and|by|to)\s*(-?\d+(?:\.\d+)?)(?:\s+please)?$/);
        if (!match) return readRequest(text.replace(/^(?:hey\s+)?(?:iris[,:]?\s+)?(?:please\s+)?/, ''));

        var left = Number(match[1]);
        var right = Number(match[2]);
        var total = left + right;
        if (!Number.isFinite(total)) return null;
        return {
            intent: 'sum',
            expression: match[1] + ' + ' + match[2],
            total: total
        };
    }

    root.ibaIrisVoiceIntent = Object.freeze({ interpret: interpret });
})(globalThis);
