import $ from "jquery";

// Emote data
import EmoteSet from "./emoteset";

// Filter function for "Twitch-style" emotes, to avoid collisions with common words
// Check if at least 3 word characters, and has at least one capital letter
// Based on current FFZ naming requirements (older FFZ emotes may not satisfy these requirements)
// See: https://www.frankerfacez.com/emoticons/submit
function emoteFilter(name) {
    return (/^\w{3,}$/.test(name) && /[A-Z]/.test(name));
}

// Global Twitch emotes (emoteset 0), filtered by emoteFilter
export const twitchEmotes = new EmoteSet({
    label: "Twitch global emotes",
    template: "https://static-cdn.jtvnw.net/emoticons/v1/{0}/{1}.0",
    sizes: [["2x", "2"], ["4x", "3"]],
    emoteStyle: EmoteSet.emoteStyle.TWITCH,
    loader() {
        return new Promise((resolve, reject) => {
            // See: https://github.com/justintv/Twitch-API/blob/master/v3_resources/chat.md#get-chatemoticons
            $.ajax("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0", {
                accepts: {json: "application/vnd.twitchtv.v3+json"},
                headers: {'Client-ID': 'a7pwjx1l6tr0ygjrzafhznzd4zgg9md'},
                dataType: "json",
                jsonp: false,
                cache: true,
            })
                .done(data => {
                    const newData = {loaded: 0, skipped: 0};
                    newData.emoteMap = new Map();
                    data.emoticon_sets[0].forEach(emoticon => {
                        if (emoteFilter(emoticon.code)) {
                            newData.emoteMap.set(emoticon.code, new EmoteSet.Emote({
                                name: emoticon.code,
                                path: emoticon.id,
                                emoteSet: this,
                            }));
                            newData.loaded++;
                        } else {
                            newData.skipped++;
                        }
                    });
                    resolve(newData);
                })
                .fail((xhr, textStatus, errorThrown) => {
                    reject(new Error(`${textStatus}, error: ${errorThrown}`));
                });
        });
    },
});

// Twitch subscriber emotes, filtered by emoteFilter
export const twitchSubEmotes = new EmoteSet({
    label: "Twitch subscriber emotes",
    template: "https://static-cdn.jtvnw.net/emoticons/v1/{0}/{1}.0",
    sizes: [["2x", "2"], ["4x", "3"]],
    emoteStyle: EmoteSet.emoteStyle.TWITCH,
    loader() {
        return new Promise((resolve, reject) => {
            // See: https://github.com/justintv/Twitch-API/blob/master/v3_resources/chat.md#get-chatemoticons
            $.ajax("https://api.twitch.tv/kraken/chat/emoticon_images", {
                accepts: {json: "application/vnd.twitchtv.v3+json"},
                headers: {'Client-ID': 'a7pwjx1l6tr0ygjrzafhznzd4zgg9md'},
                dataType: "json",
                jsonp: false,
                cache: true,
            })
                .done(data => {
                    const newData = {loaded: 0, skipped: 0};
                    newData.emoteMap = new Map();
                    data.emoticons.forEach(emoticon => {
                        if (emoticon.emoticon_set !== null && emoteFilter(emoticon.code)) {
                            newData.emoteMap.set(emoticon.code, new EmoteSet.Emote({
                                name: emoticon.code,
                                path: emoticon.id,
                                emoteSet: this,
                            }));
                            newData.loaded++;
                        } else {
                            newData.skipped++;
                        }
                    });
                    resolve(newData);
                })
                .fail((xhr, textStatus, errorThrown) => {
                    reject(new Error(`${textStatus}, error: ${errorThrown}`));
                });
        });
    },
});
