import $ from "jquery";
import _ from "lodash";

const rollRegex = /^([*])?(\w*)([*#])?$/;

// Emote data
export default class EmoteSet {
    constructor({
        label,
        template,
        caseSensitive = true,
        sizes,
        rolls = false,
        rollDefault,
        emoteStyle = EmoteSet.emoteStyle.STANDARD,
        loader = () => {},
    } = {}) {
        Object.assign(this, {label, template, caseSensitive, sizes, rolls, rollDefault, emoteStyle, loader});

        this.getRollTable = _.memoize(this.getRollTable);
        this.emoteMap = new Map();
    }

    load() {
        const loaded = Promise.resolve(this.loader())
            .then(data => Object.assign(this, data));

        loaded
            .then(({loaded, skipped}) => {
                console.info(`KawaiiDiscord: ${this.label} loaded: ${loaded}, skipped: ${skipped}`);
            })
            .catch(err => {
                console.warn(`KawaiiDiscord: ${this.label} failed to load: ${err}`);
            });

        return loaded;
    }

    getEmote(emoteName, seed) {
        if (!this.caseSensitive) {
            emoteName = emoteName.toLowerCase();
        }
        if (this.rolls) {
            const match = rollRegex.exec(emoteName);
            if (match === null) {
                return undefined;
            }
            if (match[1] !== undefined || match[3] !== undefined) {
                const table = this.getRollTable(emoteName);
                if (table.length === 0) {
                    return undefined;
                }
                if (seed === undefined || seed === 0) {
                    emoteName = this.rollDefault;
                } else {
                    emoteName = table[seed % table.length];
                }
            }
        }
        return this.emoteMap.get(emoteName);
    }

    // Create and return an emote element, or undefined if no match found
    createEmote(emoteName, seed) {
        var emote = this.getEmote(emoteName, seed);
        if (emote === undefined) {
            return undefined;
        }
        return emote.render(emoteName);
    }

    getRollTable(emoteName) {
        const match = rollRegex.exec(emoteName);
        const options = {
            start: match[1] === undefined,
            end: match[3] === undefined,
            numeric: match[3] === "#",
        };
        return this.search(match[2], options)
            .map(e => e[0])
            .sort();
    }

    search(query, {start=false, end=false, numeric=false} = {}) {
        const prefix = start ? "^" : "";
        const suffix = end ? "$" : numeric ? "\\d*$" : "";
        const queryExp = new RegExp(prefix + _.escapeRegExp(query) + suffix, "i");

        const score = function (name) {
            const d = name.length - query.length;
            const res = queryExp.exec(name);
            if (res === null) {
                return 0;
            }
            const i = res.index;
            return 1 + (i+1)*(d-i+2);
        };
        return [...this.emoteMap.keys()]
            .map(e => [e, score(e)])
            .filter(e => e[1] !== 0);
    }
}

// emoteStyle enum
EmoteSet.emoteStyle = {
    STANDARD: 0, // Surrounded by ":"
    TWITCH: 1, // Composed of "word characters" (\w)
};

// template field names enum
EmoteSet.templateField = {
    PATH: 0, // The unique path component for this emote name
    SIZE: 1, // emote size, usually a single digit between 1 and 4
};

const Emote = EmoteSet.Emote = class Emote {
    constructor({
        name,
        path,
        emoteSet = null,
    } = {}) {
        Object.assign(this, {name, path, emoteSet});
    }

    getUrl({size="1"} = {}) {
        if (!this.emoteSet || !this.emoteSet.template) {
            return this.path;
        }
        return this.emoteSet.template.replace(/{(\d+)}/g, (match, field) => {
            switch (Number(field)) {
                case EmoteSet.templateField.PATH:
                    return this.path;
                case EmoteSet.templateField.SIZE:
                    return size;
                default:
                    return match;
            }
        });
    }

    get src() {
        return this.getUrl();
    }

    get srcSet() {
        if (!this.emoteSet || !this.emoteSet.sizes) {
            return null;
        }
        return this.emoteSet.sizes
            .map(([density, size]) => {
                return this.getUrl({size}) + " " + density;
            })
            .join(",");
    }

    // Create and return an emote element
    render(emoteName) {
        if (!emoteName) {
            emoteName = this.name;
        }
        if (this.emoteSet.emoteStyle === EmoteSet.emoteStyle.STANDARD) {
            emoteName = ":"+emoteName+":";
        }
        // TODO: Apply special style to rolled emotes
        var emote = $("<img>", {
            src: this.src,
            srcSet: this.srcSet,
            draggable: "false",
            alt: emoteName,
            title: emoteName,
            class: "emoji kawaii-parseemotes",
        });
        return emote;
    }
};
