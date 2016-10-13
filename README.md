# KawaiiDiscord
A set of scripts for bringing some SFMLab chat features back to Discord.
Also, a few features from BetterDiscord, ported to the web client.

## Files

**KawaiiDiscord.user.js (for the web client)**

A userscript, last tested in Chrome 53 and Firefox 48. You will most likely need a userscript manager:
- [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) (Chrome)
- [GreaseMonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (Firefox)

**KawaiiDiscord.plugin.js (for the standalone client)**

A plugin for BetterDiscord, last tested with Discord 0.0.296 for Windows. The code is mostly adapted from the userscript, but refactored to work properly as a plugin.
Although BetterDiscord already supports Twitch emotes, this plugin parses them much more reliably.

## Features so far
- SFMLab emotes
- Twitch emotes
- Support for "mikeroll" style emotes, e.g. :mike#: randomly selects from [:mike:, :mike2:, ..., :mike124:]
- Loads emote lists at startup
- Fancy Discord-style tooltips for emotes
