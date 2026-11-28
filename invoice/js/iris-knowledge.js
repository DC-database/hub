/* Search approved procedure notes supplied by the caller.
 * Each note has an id, title, and text. Results cite the matching note and
 * return a Markdown excerpt as plain data. The caller controls access to notes.
 */
(function (root) {
    'use strict';

    var commonWords = new Set('a an and are can do for how i in is it me of on the to what when where which with'.split(' '));

    function words(value) {
        return (value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
            .filter(function (word) { return !commonWords.has(word); });
    }

    function search(query, notes) {
        var terms = Array.from(new Set(words(query)));
        if (!terms.length) return [];

        return notes.flatMap(function (note) {
            var titleWords = new Set(words(note.title));
            var best;
            note.text.split(/\r?\n(?:[ \t]*\r?\n)+/).forEach(function (block) {
                var excerpt = block.trim();
                var bodyWords = new Set(words(excerpt));
                var matched = terms.filter(function (word) {
                    return titleWords.has(word) || bodyWords.has(word);
                });
                if (!excerpt || matched.length < Math.ceil(terms.length / 2)) return;
                var score = matched.length * 3 + matched.filter(function (word) {
                    return titleWords.has(word);
                }).length;
                if (!best || score > best.score) {
                    best = { id: note.id, title: note.title, excerpt: excerpt.slice(0, 600), score: score };
                }
            });
            return best ? [best] : [];
        }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
    }

    root.ibaIrisKnowledge = Object.freeze({ search: search });
})(globalThis);
