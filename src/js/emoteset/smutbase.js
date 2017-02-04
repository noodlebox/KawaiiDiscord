import $ from "jquery";

// Emote data
import EmoteSet from "./emoteset";

// Smutbase emotes, now with more rolling than ever!
export const smutbaseEmotes = new EmoteSet({
    label: "Smutbase emotes",
    template: "https://smutba.se/media/emoji/{0}",
    caseSensitive: false,
    rolls: true,
    rollDefault: "mikeroll",
    emoteStyle: EmoteSet.emoteStyle.STANDARD,
    loader() {
        return new Promise((resolve, reject) => {
            $.ajax("https://smutba.se/emoji/json/", {dataType: "json", jsonp: false, cache: true})
                .done(data => {
                    const newData = {loaded: 0, skipped: 0};
                    newData.template = data.template;
                    newData.emoteMap = new Map();
                    data.emotes.forEach(emote => {
                        const fixName = emote.name.toLowerCase();
                        newData.emoteMap.set(fixName, new EmoteSet.Emote({
                            name: emote.name,
                            path: emote.url,
                            emoteSet: this,
                        }));
                        newData.loaded++;
                    });
                    newData.getRollTable = _.memoize(EmoteSet.prototype.getRollTable);
                    resolve(newData);
                })
                .fail((xhr, textStatus, errorThrown) => {
                    reject(new Error(`${textStatus}, error: ${errorThrown}`));
                });
        });
    },
});
