// Emote data
import EmoteSet from "./emoteset";

import { WebpackModules } from "../internals";

// Shim for handling builtin Discord emoji (including custom ones)
// Does not need to be handled for updating or rendering
//
// Though we could just grab the full list and use our searching functionality,
// the set of actually usable emoji varies depending on the current channel,
// permissions, and whether the user has Nitro. Plus, any of these may change
// at any moment. Instead, we can make use of Discord's internal search method,
// which takes all of this into account already.
export const discordEmoji = new EmoteSet({
    label: "Discord emoji",
    template: "{0}",
    emoteStyle: EmoteSet.emoteStyle.STANDARD,
    loader() {
        return new Promise((resolve, reject) => {
            // FIXME: handle lazy loading of webpack modules properly
            window.setTimeout(() => {
                // Collect needed modules from webpack
                const Emoji = WebpackModules.findByUniqueProperties(["getGuildEmoji", "search"]);
                const Channels = WebpackModules.findByUniqueProperties(["getChannel", "getChannels"]);
                const Selected = WebpackModules.findByUniqueProperties(["getChannelId", "getVoiceChannelId"]);

                // Bail if any of these are unavailable
                if (!(Emoji && Channels && Selected)) {
                    reject(new Error("unable to find webpack modules"));
                    return;
                }

                // Set up some helper functions
                const getCurrentChannel = () => Channels.getChannel(Selected.getChannelId());
                const emojiSearch = q => Emoji.search(getCurrentChannel(), q);

                const emoteMap = new Map();

                // Methods to override default EmoteSet behavior
                const search = query => {
                    const score = name => {
                        const d = name.length - query.length;
                        const i = name.toLowerCase().indexOf(query.toLowerCase());
                        if (i < 0) {
                            return Infinity;
                        }
                        return 1 + (i+1)*(d-i+2);
                    };
                    const emojiScore = emoji => {
                        if (emoji.names) {
                            return Math.min(...emoji.names.map(score));
                        }
                        return score(emoji.name);
                    };
                    const res = emojiSearch(query);
                    res.forEach(emoji => {
                        emoteMap.set(emoji.name, new EmoteSet.Emote({
                            name: emoji.name,
                            path: emoji.url,
                            emoteSet: this,
                        }));
                    });

                    return res.map(e => [e.name, emojiScore(e)]);
                };

                resolve({emoteMap, search, loaded: 0, skipped: 0});
            }, 1000);
        });
    },
});
