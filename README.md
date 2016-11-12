# KawaiiDiscord
A set of scripts for bringing some SFMLab chat features back to Discord.
Also, a few features from BetterDiscord, ported to the web client.

## Features so far
- SFMLab emotes
- Twitch emotes
- Support for "mikeroll" style emotes, e.g. :mike#: randomly selects from [:mike:, :mike2:, ..., :mike124:]
- Loads emote lists at startup
- Fancy Discord-style tooltips for emotes
- Scrollable tab-completion menu for both emote styles (overrides default completion behavior for emoji)

## Files

**KawaiiDiscord.user.js (for the web client)**

A userscript, last tested in Chrome 54 and Firefox 48. You will most likely need a userscript manager, such as [Tampermonkey](https://tampermonkey.net).

**KawaiiDiscord.plugin.js (for the standalone client)**

A plugin for BetterDiscord, last tested with Discord 0.0.296 for Windows. The code is mostly adapted from the userscript, but refactored to work properly as a plugin.
Although BetterDiscord already supports Twitch emotes, this plugin parses them much more reliably.

This plugin's development is less active for now (aside from major bug fixes) pending a transition to a build system to help avoid the mess of duplicated code and managing imported libraries in BetterDiscord (where the usual pattern is shared global everything). Alternatively, further info about upcoming changes to BetterDiscord v2's plugin API might prompt a fresh rewrite (soon:tm:). For the best experience, stick with the web client for now.
